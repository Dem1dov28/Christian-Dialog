"""
Интеграция с Telegram Stars (оплата в Mini App).
Документация: https://core.telegram.org/bots/payments-stars

Поток:
1. POST /payments/telegram-stars/create-invoice → invoice_url
2. Frontend (в Mini App) вызывает WebApp.openInvoice(invoice_url)
3. Пользователь платит Stars в Telegram
4. Telegram шлёт pre_checkout_query → answerPreCheckoutQuery
5. Telegram шлёт successful_payment → активируем подписку
"""
import logging
from datetime import datetime
from typing import Optional

import httpx
from sqlmodel import Session, select

from config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME,
    TELEGRAM_ENABLED,
    TELEGRAM_STARS_PRICE_PLUS,
    TELEGRAM_STARS_PRICE_PRO,
    TELEGRAM_CHANNEL_URL,
    BASE_URL,
)
from models.user import User
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

TIER_PRICES = {"plus": TELEGRAM_STARS_PRICE_PLUS, "pro": TELEGRAM_STARS_PRICE_PRO}


def is_telegram_stars_enabled() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_ENABLED)


def _bot_request(method: str, data: dict) -> Optional[dict]:
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}"
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, json=data)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error("Telegram Bot API error %s: %s", method, e)
        return None


def create_invoice_link(user_id: int, tier: str, title: str, description: str) -> Optional[str]:
    """
    Создать ссылку на инвойс Telegram Stars.
    payload: user_id:tier (для верификации при successful_payment)
    """
    if tier not in ("plus", "pro"):
        return None

    amount = TIER_PRICES.get(tier, TIER_PRICES["plus"])
    payload = f"{user_id}:{tier}"

    data = {
        "title": title[:32],
        "description": description[:255],
        "payload": payload[:128],
        "currency": "XTR",
        "prices": [{"label": title[:32] if len(title) <= 32 else title[:29] + "...", "amount": amount}],
    }

    result = _bot_request("createInvoiceLink", data)
    if result and result.get("ok"):
        return result.get("result")
    return None


def answer_pre_checkout_query(pre_checkout_query_id: str, ok: bool, error_message: Optional[str] = None) -> bool:
    data = {"pre_checkout_query_id": pre_checkout_query_id, "ok": ok}
    if not ok and error_message:
        data["error_message"] = error_message[:256]
    result = _bot_request("answerPreCheckoutQuery", data)
    return bool(result and result.get("ok"))


def _parse_payload(payload: str) -> tuple[Optional[int], Optional[str]]:
    try:
        parts = payload.split(":", 1)
        if len(parts) != 2:
            return None, None
        return int(parts[0]), parts[1].strip().lower()
    except (ValueError, AttributeError):
        return None, None


def send_bot_start_response(chat_id: int) -> bool:
    """
    Отправить приветственное сообщение с картинкой BotStart.png и кнопками при /start.
    1) Пытаемся отправить фото по публичному URL https://epochaldialog.com/images/BotStart.png
    2) В любом случае отправляем текстовое сообщение с кнопками (fallback, если фото не загрузилось)
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("send_bot_start_response: TELEGRAM_BOT_TOKEN не задан")
        return False
    
    app_url = f"https://t.me/{TELEGRAM_BOT_USERNAME}/app" if TELEGRAM_BOT_USERNAME else ""
    rows = []
    if app_url:
        rows.append([{"text": "Открыть приложение", "url": app_url}])
    rows.append([{"text": "Наш канал", "url": TELEGRAM_CHANNEL_URL}])
    keyboard = {"inline_keyboard": rows}
    
    # 1. Пытаемся отправить фото (BotStart.png лежит во frontend/public/images/BotStart.png)
    photo_url = f"{BASE_URL.rstrip('/')}/images/BotStart.png"
    _bot_request("sendPhoto", {
        "chat_id": chat_id,
        "photo": photo_url,
        "reply_markup": keyboard,
    })
    
    # 2. Гарантированно отправляем текст + кнопки (даже если sendPhoto вернул ошибку)
    text = (
        "Мы оживили более 100 исторических личностей с помощью ИИ, "
        "общайся с кем хочешь, а так же создавай групповые чаты и своих собственных персонажей!  👇"
    )
    result = _bot_request("sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "reply_markup": keyboard,
    })
    return bool(result and result.get("ok"))


def process_successful_payment(db: Session, user_id: int, tier: str, telegram_payment_charge_id: str) -> bool:
    """Активировать подписку после успешной оплаты Stars."""
    if tier not in ("plus", "pro"):
        return False

    user = db.get(User, user_id)
    if not user:
        logger.warning("Telegram Stars: user %s not found", user_id)
        return False

    result = SubscriptionService.upgrade_subscription(db, user, tier, None)
    if result.get("success"):
        from datetime import datetime
        user.expires_at = SubscriptionService._add_months(datetime.utcnow(), 1)
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        logger.info("Telegram Stars: activated %s for user %s (charge_id=%s)", tier, user_id, telegram_payment_charge_id)
        return True
    logger.warning("Telegram Stars: upgrade_subscription failed for user %s: %s", user_id, result)
    return False
