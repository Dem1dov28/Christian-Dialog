"""
API для оплаты подписок.
Поддерживает:
  - Telegram Stars (оплата в Mini App)
  - CryptoCloud PAY (крипто-платежи, docs.cryptocloud.plus)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session

from config import TELEGRAM_STARS_PRICE_PLUS, TELEGRAM_STARS_PRICE_PRO
from core.database import get_session
from core.dependencies import get_current_active_user
from models.user import User
from services.cryptocloud_service import (
    create_invoice as cryptocloud_create_invoice,
    handle_postback as cryptocloud_handle_postback,
    is_cryptocloud_enabled,
)
from services.telegram_stars_service import (
    create_invoice_link as telegram_stars_create_invoice,
    is_telegram_stars_enabled,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


# ---------------------------------------------------------------------------
# Общий конфиг (какие провайдеры включены)
# ---------------------------------------------------------------------------

@router.get("/config")
def get_payments_config():
    """Возвращает, какие платёжные провайдеры активны и цены в Stars."""
    return {
        "cryptocloud_enabled": is_cryptocloud_enabled(),
        "telegram_stars_enabled": is_telegram_stars_enabled(),
        "telegram_stars_price_plus": TELEGRAM_STARS_PRICE_PLUS,
        "telegram_stars_price_pro": TELEGRAM_STARS_PRICE_PRO,
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
# Telegram Stars — создать инвойс (для Mini App)
# ---------------------------------------------------------------------------

class TelegramStarsCheckoutRequest(BaseModel):
    tier: str  # "plus" | "pro"


class TelegramStarsCheckoutResponse(BaseModel):
    invoice_url: str | None = None
    error: str | None = None
    enabled: bool = True


@router.post("/telegram-stars/create-invoice", response_model=TelegramStarsCheckoutResponse)
async def post_telegram_stars_create_invoice(
    body: TelegramStarsCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Создать инвойс Telegram Stars. Возвращает invoice_url.
    Frontend в Mini App вызывает WebApp.openInvoice(invoice_url).
    """
    if body.tier not in ("plus", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tier должен быть plus или pro",
        )

    titles = {"plus": "Plus", "pro": "Pro"}
    descriptions = {
        "plus": "Подписка Plus — 500 сообщений/месяц, доступ к Plus-агентам",
        "pro": "Подписка Pro — расширенные возможности, API",
    }
    invoice_url = telegram_stars_create_invoice(
        user_id=current_user.id,
        tier=body.tier,
        title=titles[body.tier],
        description=descriptions[body.tier],
    )

    if not invoice_url:
        return TelegramStarsCheckoutResponse(
            error="Не удалось создать счёт",
            enabled=is_telegram_stars_enabled(),
        )

    return TelegramStarsCheckoutResponse(invoice_url=invoice_url, enabled=True)


