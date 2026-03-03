"""
Верификация initData от Telegram Web App.
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hmac
import hashlib
from urllib.parse import unquote
from typing import Optional


def validate_telegram_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """
    Проверяет подпись initData от Telegram и возвращает распарсенные данные.
    Возвращает None при невалидной подписи.
    """
    if not init_data or not bot_token:
        return None

    try:
        # Парсим query string
        parsed = {}
        hash_value = None

        for chunk in init_data.split("&"):
            if "=" not in chunk:
                continue
            key, _, value = chunk.partition("=")
            value = unquote(value)
            if key == "hash":
                hash_value = value
            else:
                parsed[key] = value

        if not hash_value:
            return None

        # Собираем data-check-string: сортированные ключи (без hash), значения через \n
        data_check = "\n".join(
            f"{k}={parsed[k]}" for k in sorted(parsed.keys())
        )

        # Секретный ключ: HMAC-SHA256("WebAppData", bot_token)
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        # Вычисляем хеш
        calculated_hash = hmac.new(
            secret_key,
            data_check.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, hash_value):
            return None

        # Проверяем auth_date — не старше 24 часов (опционально, но рекомендуется)
        auth_date_str = parsed.get("auth_date")
        if auth_date_str:
            try:
                auth_date = int(auth_date_str)
                import time
                if abs(time.time() - auth_date) > 86400:  # 24 часа
                    return None
            except (ValueError, TypeError):
                return None

        return parsed
    except Exception:
        return None


def parse_telegram_user(parsed: dict) -> dict:
    """Извлекает user из parsed initData (JSON строка в поле user)."""
    import json
    user_str = parsed.get("user")
    if not user_str:
        return {}
    try:
        return json.loads(user_str)
    except (json.JSONDecodeError, TypeError):
        return {}


def validate_telegram_widget_data(data: dict, bot_token: str) -> bool:
    """
    Проверяет подпись данных от Telegram Login Widget.
    https://core.telegram.org/widgets/login#checking-authorization
    data: {id, first_name, last_name?, username?, photo_url?, auth_date, hash}
    """
    if not data or not bot_token:
        return False

    hash_value = data.get("hash")
    if not hash_value:
        return False

    # data_check_string: key=value, sorted alphabetically, \n separator (без hash)
    fields = {k: str(v) if v is not None else "" for k, v in data.items() if k != "hash"}
    data_check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields.keys()))

    # secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # computed_hash = HMAC-SHA256(data_check, secret_key)
    computed_hash = hmac.new(
        secret_key,
        data_check.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, hash_value):
        return False

    # auth_date — не старше 24 часов
    auth_date_str = data.get("auth_date")
    if auth_date_str:
        try:
            import time
            auth_date = int(auth_date_str)
            if abs(time.time() - auth_date) > 86400:
                return False
        except (ValueError, TypeError):
            return False

    return True
