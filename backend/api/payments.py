"""
API для оплаты подписок.
Поддерживает два провайдера:
  - CryptoCloud PAY (крипто-платежи, docs.cryptocloud.plus)
  - BePaid (карточные платежи, docs.bepaid.by)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlmodel import Session

from config import BEPAID_SHOP_ID, BEPAID_SECRET_KEY
from core.database import get_session
from core.dependencies import get_current_active_user
from models.user import User
from services.bepaid_service import (
    create_checkout as bepaid_create_checkout,
    handle_webhook as bepaid_handle_webhook,
    is_bepaid_enabled,
)
from services.cryptocloud_service import (
    create_invoice as cryptocloud_create_invoice,
    handle_postback as cryptocloud_handle_postback,
    is_cryptocloud_enabled,
)

logger = logging.getLogger(__name__)
security_basic = HTTPBasic(auto_error=False)

router = APIRouter(prefix="/payments", tags=["payments"])


# ---------------------------------------------------------------------------
# Общий конфиг (какие провайдеры включены)
# ---------------------------------------------------------------------------

@router.get("/config")
def get_payments_config():
    """Возвращает, какие платёжные провайдеры активны."""
    return {
        "cryptocloud_enabled": is_cryptocloud_enabled(),
        "bepaid_enabled": is_bepaid_enabled(),
    }


# ---------------------------------------------------------------------------
# CryptoCloud — создать инвойс
# ---------------------------------------------------------------------------

class CryptoCloudCheckoutRequest(BaseModel):
    tier: str  # "plus" | "pro"


class CryptoCloudCheckoutResponse(BaseModel):
    link: str | None = None
    uuid: str | None = None
    error: str | None = None
    enabled: bool = True


@router.post("/cryptocloud/create-invoice", response_model=CryptoCloudCheckoutResponse)
async def post_cryptocloud_create_invoice(
    body: CryptoCloudCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Создать инвойс в CryptoCloud. Возвращает link — страница оплаты.
    Фронт редиректит пользователя на этот link.
    """
    if body.tier not in ("plus", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tier должен быть plus или pro",
        )

    result = await cryptocloud_create_invoice(user=current_user, tier=body.tier)

    if "error" in result:
        return CryptoCloudCheckoutResponse(
            error=result["error"],
            enabled=is_cryptocloud_enabled(),
        )

    return CryptoCloudCheckoutResponse(
        link=result["link"],
        uuid=result.get("uuid"),
        enabled=True,
    )


# ---------------------------------------------------------------------------
# CryptoCloud — postback (уведомление об оплате)
# Notification URL в ЛК CryptoCloud: https://ваш-домен.com/payments/cryptocloud/callback
# ---------------------------------------------------------------------------

@router.post("/cryptocloud/callback")
async def cryptocloud_postback(
    request: Request,
    db: Session = Depends(get_session),
):
    """
    Postback (webhook) от CryptoCloud после успешной оплаты.
    CryptoCloud шлёт POST с JSON: status, invoice_id, order_id, token, amount_crypto, currency.
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.warning("CryptoCloud postback: invalid JSON: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    ok = cryptocloud_handle_postback(body, db)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Postback processing failed",
        )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# BePaid — создать подписку
# ---------------------------------------------------------------------------

class BePaidCheckoutRequest(BaseModel):
    tier: str        # "plus" | "pro"
    return_url: str  # URL фронта, куда вернуть пользователя после оплаты


class BePaidCheckoutResponse(BaseModel):
    redirect_url: str | None = None
    subscription_id: str | None = None
    error: str | None = None
    enabled: bool = True


@router.post("/bepaid/create-checkout", response_model=BePaidCheckoutResponse)
async def post_bepaid_create_checkout(
    body: BePaidCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session),
):
    """
    Создать подписку в BePaid. Возвращает redirect_url.
    """
    if body.tier not in ("plus", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tier должен быть plus или pro",
        )

    result = await bepaid_create_checkout(
        user=current_user,
        tier=body.tier,
        return_url=body.return_url,
        db=db,
    )

    if "error" in result:
        return BePaidCheckoutResponse(
            error=result["error"],
            enabled=is_bepaid_enabled(),
        )

    return BePaidCheckoutResponse(
        redirect_url=result["redirect_url"],
        subscription_id=result.get("subscription_id"),
        enabled=True,
    )


# ---------------------------------------------------------------------------
# BePaid — webhook
# ---------------------------------------------------------------------------

def _verify_bepaid_webhook(credentials: HTTPBasicCredentials | None) -> None:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
        )
    if credentials.username != BEPAID_SHOP_ID or credentials.password != BEPAID_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )


@router.post("/bepaid/webhook")
async def bepaid_webhook(
    request: Request,
    db: Session = Depends(get_session),
    credentials: HTTPBasicCredentials | None = Depends(security_basic),
):
    """
    Webhook от BePaid при изменении статуса подписки.
    BePaid шлёт HTTP Basic auth (shop_id:secret_key).
    """
    if BEPAID_SHOP_ID and BEPAID_SECRET_KEY:
        _verify_bepaid_webhook(credentials)
    try:
        body = await request.json()
    except Exception as e:
        logger.warning("BePaid webhook invalid JSON: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    ok = bepaid_handle_webhook(body, db)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed",
        )
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Обратная совместимость: старые URL /payments/webhook и /payments/create-checkout
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def bepaid_webhook_compat(
    request: Request,
    db: Session = Depends(get_session),
    credentials: HTTPBasicCredentials | None = Depends(security_basic),
):
    """Псевдоним для /payments/bepaid/webhook (обратная совместимость)."""
    return await bepaid_webhook(request, db, credentials)


@router.post("/create-checkout")
async def bepaid_create_checkout_compat(
    body: BePaidCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session),
):
    """Псевдоним для /payments/bepaid/create-checkout (обратная совместимость)."""
    return await post_bepaid_create_checkout(body, current_user, db)
