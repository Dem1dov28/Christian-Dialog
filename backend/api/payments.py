"""
API для оплаты подписок через BePaid.
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
from services.bepaid_service import create_checkout, handle_webhook, is_bepaid_enabled

logger = logging.getLogger(__name__)
security_basic = HTTPBasic(auto_error=False)

router = APIRouter(prefix="/payments", tags=["payments"])


class CreateCheckoutRequest(BaseModel):
    tier: str  # "plus" | "pro"
    return_url: str  # полный URL страницы успеха на фронте, например https://app.example.com/subscription-success


class CreateCheckoutResponse(BaseModel):
    redirect_url: str | None = None
    subscription_id: str | None = None
    error: str | None = None
    bepaid_enabled: bool = True


@router.get("/config")
def get_payments_config():
    """Публичный эндпоинт: включена ли оплата через BePaid (для отображения кнопок «Оплатить»)."""
    return {"bepaid_enabled": is_bepaid_enabled()}


@router.post("/create-checkout")
async def post_create_checkout(
    body: CreateCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session),
):
    """
    Создать сессию оплаты подписки в BePaid. Возвращает redirect_url для редиректа пользователя.
    """
    if body.tier not in ("plus", "pro"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tier должен быть plus или pro",
        )

    result = await create_checkout(
        user=current_user,
        tier=body.tier,
        return_url=body.return_url,
        db=db,
    )

    if "error" in result:
        return CreateCheckoutResponse(
            error=result["error"],
            bepaid_enabled=is_bepaid_enabled(),
        )

    return CreateCheckoutResponse(
        redirect_url=result["redirect_url"],
        subscription_id=result.get("subscription_id"),
        bepaid_enabled=True,
    )


def _verify_bepaid_webhook(credentials: HTTPBasicCredentials | None) -> None:
    """Проверить Basic auth от BePaid (shop_id:secret_key)."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    if credentials.username != BEPAID_SHOP_ID or credentials.password != BEPAID_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@router.post("/webhook")
async def bepaid_webhook(
    request: Request,
    db: Session = Depends(get_session),
    credentials: HTTPBasicCredentials | None = Depends(security_basic),
):
    """
    Webhook от BePaid при изменении статуса подписки.
    BePaid отправляет сюда HTTP Basic auth (shop_id:secret_key). Тело — JSON подписки.
    """
    if BEPAID_SHOP_ID and BEPAID_SECRET_KEY:
        _verify_bepaid_webhook(credentials)
    try:
        body = await request.json()
    except Exception as e:
        logger.warning("BePaid webhook invalid JSON: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    ok = handle_webhook(body, db)
    if not ok:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing failed")
    return {"status": "ok"}
