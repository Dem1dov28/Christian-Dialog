"""
Сервис интеграции с платёжной системой BePaid для подписок.
Документация: https://docs.bepaid.by/en/payment_management/subscriptions/
"""
import logging
from typing import Optional
import httpx
from sqlmodel import Session, select

from config import (
    BEPAID_SHOP_ID,
    BEPAID_SECRET_KEY,
    BEPAID_API_URL,
    BEPAID_PLAN_PLUS_ID,
    BEPAID_PLAN_PRO_ID,
    BEPAID_BACKEND_BASE,
    BEPAID_ENABLED,
)
from models.user import User
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

# Маппинг тарифов на ID планов BePaid
TIER_TO_PLAN_ID = {
    "plus": BEPAID_PLAN_PLUS_ID,
    "pro": BEPAID_PLAN_PRO_ID,
}


def _auth_header() -> tuple[str, str]:
    """HTTP Basic auth: (username, password) = (shop_id, secret_key)."""
    return (BEPAID_SHOP_ID, BEPAID_SECRET_KEY)


def is_bepaid_enabled() -> bool:
    return BEPAID_ENABLED


async def create_checkout(
    user: User,
    tier: str,
    return_url: str,
    db: Optional[Session] = None,
) -> dict:
    """
    Создать подписку в BePaid и получить URL для редиректа пользователя на оплату.

    Args:
        user: Пользователь
        tier: Тариф "plus" или "pro"
        return_url: Полный URL фронта, куда вернуть пользователя после оплаты (BePaid добавит ?id=sbs_xxx)
        db: Сессия БД для сохранения bepaid_customer_id после ответа (опционально)

    Returns:
        {"redirect_url": "https://...", "subscription_id": "sbs_..."} или {"error": "..."}
    """
    if not BEPAID_ENABLED:
        return {"error": "Платёжная система отключена"}

    plan_id = TIER_TO_PLAN_ID.get(tier)
    if not plan_id:
        return {"error": f"Тариф {tier} не поддерживается для оплаты через BePaid"}

    notification_url = f"{BEPAID_BACKEND_BASE.rstrip('/')}/payments/webhook"
    tracking_id = str(user.id)

    # Customer: используем существующий bepaid_customer_id или передаём данные для создания
    customer_payload = {}
    if user.bepaid_customer_id:
        customer_payload["id"] = user.bepaid_customer_id
    else:
        name_parts = (user.full_name or user.username or "User").strip().split(maxsplit=1)
        customer_payload["email"] = user.email
        customer_payload["first_name"] = name_parts[0] if name_parts else "User"
        customer_payload["last_name"] = name_parts[1] if len(name_parts) > 1 else ""

    body = {
        "plan": {"id": plan_id},
        "customer": customer_payload,
        "return_url": return_url,
        "notification_url": notification_url,
        "tracking_id": tracking_id,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{BEPAID_API_URL}/subscriptions",
                json=body,
                auth=_auth_header(),
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            data = response.json()

            if response.status_code == 201:
                redirect_url = data.get("redirect_url")
                subscription_id = data.get("id")
                if not redirect_url:
                    logger.warning("BePaid returned 201 but no redirect_url: %s", data)
                    return {"error": "Нет ссылки на оплату в ответе BePaid"}

                # Сохраняем customer id из ответа для последующих подписок
                customer = data.get("customer") or {}
                cst_id = customer.get("id") if isinstance(customer, dict) else None
                if cst_id and db and user:
                    user.bepaid_customer_id = cst_id
                    user.bepaid_subscription_id = subscription_id
                    db.add(user)
                    db.commit()

                return {
                    "redirect_url": redirect_url,
                    "subscription_id": subscription_id,
                }
            else:
                msg = data.get("message", response.text) or f"HTTP {response.status_code}"
                logger.warning("BePaid create subscription failed: %s %s", response.status_code, data)
                return {"error": msg}
        except httpx.RequestError as e:
            logger.exception("BePaid request error: %s", e)
            return {"error": "Ошибка связи с платёжной системой"}


def handle_webhook(payload: dict, db: Session) -> bool:
    """
    Обработать webhook от BePaid (изменение статуса подписки).

    Обновляет подписку пользователя по tracking_id (user_id) или по id подписки.
    Возвращает True если обработано успешно.
    """
    subscription_id = payload.get("id")
    state = payload.get("state")
    tracking_id = payload.get("tracking_id")

    if not state:
        logger.warning("BePaid webhook without state: %s", payload)
        return False

    # Найти пользователя: по tracking_id (мы передаём user_id) или по bepaid_subscription_id
    user = None
    if tracking_id:
        try:
            user_id = int(tracking_id)
            user = db.exec(select(User).where(User.id == user_id)).first()
        except (ValueError, TypeError):
            pass
    if not user and subscription_id:
        user = db.exec(
            select(User).where(User.bepaid_subscription_id == subscription_id)
        ).first()

    if not user:
        logger.warning("BePaid webhook: user not found for tracking_id=%s subscription_id=%s", tracking_id, subscription_id)
        return True  # всё равно 200, чтобы BePaid не слал повторно

    # Активные статусы — подписка оплачена
    if state in ("active", "trial", "trial_processing", "processing"):
        plan = payload.get("plan") or {}
        plan_id = plan.get("id") if isinstance(plan, dict) else None
        tier = None
        if plan_id == BEPAID_PLAN_PLUS_ID:
            tier = "plus"
        elif plan_id == BEPAID_PLAN_PRO_ID:
            tier = "pro"
        if tier:
            renew_at = payload.get("renew_at")
            active_to = payload.get("active_to")
            from datetime import datetime
            expires_dt = None
            if active_to:
                try:
                    expires_dt = datetime.fromisoformat(active_to.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            if not expires_dt and renew_at:
                try:
                    expires_dt = datetime.fromisoformat(renew_at.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            result = SubscriptionService.upgrade_subscription(db, user, tier, None)
            if result.get("success") and expires_dt:
                user.expires_at = expires_dt
                user.bepaid_subscription_id = subscription_id
                db.add(user)
                db.commit()
            logger.info("BePaid webhook: user %s subscription set to %s", user.id, tier)
        else:
            logger.warning("BePaid webhook: unknown plan_id %s", plan_id)

    # Отмена или ошибка — сбрасываем платную подписку
    elif state in ("canceled", "failed", "error", "expired"):
        if user.subscription_tier in ("plus", "pro"):
            user.subscription_tier = "free"
            config = SubscriptionService.get_subscription_config("free")
            user.messages_limit = config["messages_limit"]
            user.api_access = False
            user.expires_at = None
            user.bepaid_subscription_id = None
            user.messages_used = 0
            from datetime import datetime
            user.updated_at = datetime.utcnow()
            db.add(user)
            db.commit()
            logger.info("BePaid webhook: user %s downgraded to free (state=%s)", user.id, state)

    return True
