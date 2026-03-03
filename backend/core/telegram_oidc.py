"""
Telegram OIDC (Log In With Telegram) — верификация id_token (JWT).
https://core.telegram.org/bots/telegram-login
"""
import httpx
from typing import Optional
from jose import jwt, jwk

TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json"
TELEGRAM_ISSUER = "https://oauth.telegram.org"


def _fetch_jwks() -> dict:
    """Получить JWKS от Telegram (с кэшем на время жизни процесса)."""
    with httpx.Client(timeout=10) as client:
        resp = client.get(TELEGRAM_JWKS_URL)
        resp.raise_for_status()
        return resp.json()


def verify_telegram_id_token(id_token: str, client_id: str) -> Optional[dict]:
    """
    Верифицирует JWT id_token от Telegram OAuth.
    Возвращает payload при успехе, None при ошибке.
    """
    if not id_token or not client_id:
        return None

    try:
        jwks = _fetch_jwks()
        unverified = jwt.get_unverified_header(id_token)
        kid = unverified.get("kid")
        if not kid:
            return None

        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = jwk.construct(k)
                break
        if not key:
            return None

        payload = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=str(client_id),
            issuer=TELEGRAM_ISSUER,
            options={"verify_aud": True, "verify_iss": True, "verify_exp": True},
        )

        return payload
    except Exception:
        return None
