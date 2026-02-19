"""
Сервис интеграции с платёжной системой CryptoCloud PAY.
Документация: https://docs.cryptocloud.plus/en/api-reference-v2/create-invoice

Поток оплаты:
  1. POST /v2/invoice/create  → получаем link (страница оплаты) и uuid (INV-xxx)
  2. Редиректим пользователя на link
  3. После оплаты CryptoCloud:
     - редиректит пользователя на success_url / fail_url (настроены в ЛК проекта)
     - отправляет POST-запрос (postback) на notification_url
  4. В postback мы верифицируем JWT-токен и активируем подписку

Примечание: CryptoCloud принимает только КРИПТО-платежи (BTC, ETH, USDT и др.).
            Рекуррентных (автоматических ежемесячных) списаний нет — пользователь
            платит вручную каждый месяц, получая ещё +30 дней подписки.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from jose import jwt, JWTError
from sqlmodel import Session, select

from config import (
    CRYPTOCLOUD_API_KEY,
    CRYPTOCLOUD_SHOP_ID,
    CRYPTOCLOUD_SECRET_KEY,
    CRYPTOCLOUD_API_URL,
    CRYPTOCLOUD_PRICE_PLUS,
    CRYPTOCLOUD_PRICE_PRO,
    CRYPTOCLOUD_ENABLED,
)
from models.user import User
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

TIER_PRICES = {
    "plus": CRYPTOCLOUD_PRICE_PLUS,
    "pro": CRYPTOCLOUD_PRICE_PRO,
}

# order_id, который мы передаём в инвойс: "<user_id>:<tier>"
# Например: "42:plus"


def is_cryptocloud_enabled() -> bool:
    return CRYPTOCLOUD_ENABLED


def _make_order_id(user_id: int, tier: str) -> str:
    return f"{user_id}:{tier}"


def _parse_order_id(order_id: str) -> tuple[int | None, str | None]:
    """Разобрать order_id → (user_id, tier). Вернёт (None, None) при ошибке."""
    try:
        parts = order_id.split(":", 1)
        if len(parts) != 2:
            return None, None
        user_id = int(parts[0])
        tier = parts[1].strip().lower()
        if tier not in ("plus", "pro"):
            return None, None
        return user_id, tier
    except (ValueError, AttributeError):
        return None, None


async def create_invoice(user: User, tier: str) -> dict:
    """
    Создать инвойс в CryptoCloud.

    Returns:
        {"link": "https://pay.cryptocloud.plus/...", "uuid": "INV-xxx"} или {"error": "..."}
    """
    if not CRYPTOCLOUD_ENABLED:
        return {"error": "Платёжная система отключена"}

    price = TIER_PRICES.get(tier)
    if price is None:
        return {"error": f"Тариф {tier} не поддерживается"}

    payload = {
        "amount": price,
        "shop_id": CRYPTOCLOUD_SHOP_ID,
        "currency": "USD",
        "order_id": _make_order_id(user.id, tier),
        "email": user.email,
        "add_fields": {
            "time_to_pay": {"hours": 24, "minutes": 0},
        },
    }

    headers = {
        "Authorization": f"Token {CRYPTOCLOUD_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{CRYPTOCLOUD_API_URL}/v2/invoice/create",
                json=payload,
                headers=headers,
            )
            data = response.json()

            if response.status_code == 200 and data.get("status") == "success":
                result = data.get("result", {})
                link = result.get("link")
                uuid = result.get("uuid")
                if not link:
                    logger.warning("CryptoCloud: no link in response: %s", data)
                    return {"error": "Нет ссылки на оплату в ответе CryptoCloud"}
                return {"link": link, "uuid": uuid}
            else:
                err = data.get("result") or data.get("message") or f"HTTP {response.status_code}"
                logger.warning("CryptoCloud create invoice failed: %s %s", response.status_code, data)
                return {"error": str(err)}
        except httpx.RequestError as e:
            logger.exception("CryptoCloud request error: %s", e)
            return {"error": "Ошибка связи с платёжной системой"}


def verify_postback_token(token: str) -> dict | None:
    """
    Проверить JWT-токен из postback CryptoCloud.
    Токен подписан CRYPTOCLOUD_SECRET_KEY (HS256), действителен 5 минут.
    Возвращает payload или None при ошибке.
    """
    try:
        payload = jwt.decode(token, CRYPTOCLOUD_SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError as e:
        logger.warning("CryptoCloud postback JWT error: %s", e)
        return None


def handle_postback(payload: dict, db: Session) -> bool:
    """
    Обработать postback (webhook) от CryptoCloud после оплаты.

    Поля postback:
        status        — "success" при успешной оплате
        invoice_id    — короткий ID платежа (XXXXXXXX)
        order_id      — наш order_id вида "<user_id>:<tier>"
        token         — JWT для верификации
        amount_crypto — сумма в крипте
        currency      — криптовалюта

    Возвращает True при успешной обработке (200 для CryptoCloud), False при ошибке.
    """
    status = payload.get("status")
    order_id = payload.get("order_id") or ""
    token = payload.get("token") or ""
    invoice_id = payload.get("invoice_id", "")

    logger.info(
        "CryptoCloud postback: status=%s order_id=%s invoice_id=%s",
        status, order_id, invoice_id,
    )

    # Проверяем JWT-токен
    if CRYPTOCLOUD_SECRET_KEY:
        jwt_payload = verify_postback_token(token)
        if jwt_payload is None:
            logger.warning("CryptoCloud postback: invalid JWT token, ignoring")
            # Возвращаем True, чтобы не получать повторные запросы с невалидным токеном
            return True

    if status != "success":
        logger.info("CryptoCloud postback: non-success status '%s', ignoring", status)
        return True

    # Разбираем order_id → user_id, tier
    user_id, tier = _parse_order_id(order_id)
    if not user_id or not tier:
        logger.warning("CryptoCloud postback: can't parse order_id='%s'", order_id)
        return True

    # Находим пользователя
    user = db.exec(select(User).where(User.id == user_id)).first()
    if not user:
        logger.warning("CryptoCloud postback: user %s not found", user_id)
        return True

    # Активируем подписку
    result = SubscriptionService.upgrade_subscription(db, user, tier, None)
    if result.get("success"):
        # Устанавливаем срок: +1 месяц от сейчас
        expires_dt = SubscriptionService._add_months(datetime.utcnow(), 1)
        user.expires_at = expires_dt
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        logger.info(
            "CryptoCloud postback: user %s upgraded to %s, expires %s",
            user_id, tier, expires_dt,
        )
    else:
        logger.error(
            "CryptoCloud postback: upgrade_subscription failed for user %s tier %s: %s",
            user_id, tier, result,
        )

    return True
