"""
Webhook для Telegram Bot API — обработка pre_checkout_query и successful_payment (Telegram Stars).
Установить webhook: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/webhook/telegram
"""
import logging
from fastapi import APIRouter, Request, Depends
from fastapi.responses import Response
from sqlmodel import Session

from core.database import get_session
from services.telegram_stars_service import (
    answer_pre_checkout_query,
    process_successful_payment,
    _parse_payload,
    is_telegram_stars_enabled,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["telegram-webhook"])


@router.post("/telegram")
async def telegram_bot_webhook(request: Request, db: Session = Depends(get_session)):
    """
    Webhook для Telegram Bot. Обрабатывает только pre_checkout_query и successful_payment.
    """
    if not is_telegram_stars_enabled():
        return Response(status_code=200)

    try:
        body = await request.json()
    except Exception as e:
        logger.warning("Telegram webhook: invalid JSON %s", e)
        return Response(status_code=200)

    update_id = body.get("update_id")

    # pre_checkout_query — пользователь нажал Pay
    pre = body.get("pre_checkout_query")
    if pre:
        query_id = pre.get("id")
        payload = pre.get("invoice_payload", "")
        user_id, tier = _parse_payload(payload)
        if user_id and tier:
            answer_pre_checkout_query(query_id, ok=True)
        else:
            answer_pre_checkout_query(query_id, ok=False, error_message="Неверный платёж")
        return Response(status_code=200)

    # successful_payment — оплата прошла
    msg = body.get("message")
    if msg:
        success = msg.get("successful_payment")
        if success:
            payload = success.get("invoice_payload", "")
            charge_id = success.get("telegram_payment_charge_id", "")
            user_id, tier = _parse_payload(payload)
            if user_id and tier:
                process_successful_payment(db, user_id, tier, charge_id)

    return Response(status_code=200)
