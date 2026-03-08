"""CSRF protection middleware.

Простая защита:
- Для методов, изменяющих состояние (POST/PUT/PATCH/DELETE), требует:
  - cookie `csrf_token`
  - заголовок `X-CSRF-Token`
  - совпадение значений.
- Если cookie отсутствует, middleware выставляет новый csrf_token в ответе.
"""

from __future__ import annotations

import secrets
from typing import Iterable

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from config import ENVIRONMENT, ALLOWED_ORIGINS


SAFE_METHODS: Iterable[str] = ("GET", "HEAD", "OPTIONS", "TRACE")
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"

# Пути, для которых CSRF проверка не требуется.
# Для этих эндпоинтов защита обеспечивается другими механизмами
# (например, проверкой origin через CORS, аутентификацией и валидацией внешнего токена).
CSRF_EXEMPT_PATHS: Iterable[str] = (
    "/auth/login",                  # вход по логину/паролю (JSON / form)
    "/auth/logout",                 # выход — просто очистка cookie
    "/auth/register",               # регистрация
    "/auth/send-registration-code",
    "/auth/send-reset-code",
    "/auth/verify-reset-code",
    "/auth/reset-password",
    "/auth/google",                 # вход через Google ID token
    "/auth/telegram",               # вход через Telegram initData
    "/auth/send-telegram-link-code",   # отправить код для привязки
    "/auth/verify-and-link-telegram",  # привязка Telegram к существующему аккаунту
    "/auth/telegram/create-account",   # создание нового аккаунта с привязкой Telegram
    "/auth/telegram-oidc",             # Log In With Telegram (OIDC)
    "/webhook/telegram",               # Telegram Bot webhook (Stars payments)
)


class CSRFMiddleware(BaseHTTPMiddleware):
  async def dispatch(self, request: Request, call_next):
    method = request.method.upper()
    path = request.url.path or ""
    referer = request.headers.get("referer") or ""
    origin = request.headers.get("origin") or ""

    # Exempt CSRF когда запрос от нашего фронтенда:
    # 1) Referer содержит telegram.org — Mini App в iframe (cookies не уходят)
    # 2) Origin в ALLOWED_ORIGINS — SPA на epochaldialog.com (Origin нельзя подделать из другого домена)
    from_telegram = "telegram.org" in referer
    from_allowed_origin = origin in ALLOWED_ORIGINS if ALLOWED_ORIGINS else False

    # CSRF проверка — до call_next, чтобы не выполнять endpoint при невалидном запросе
    if (
        method not in SAFE_METHODS
        and not from_telegram
        and not from_allowed_origin
        and not any(path.startswith(p) for p in CSRF_EXEMPT_PATHS)
    ):
      header_token = request.headers.get(CSRF_HEADER_NAME)
      cookie_token = request.cookies.get(CSRF_COOKIE_NAME)

      if not header_token or not cookie_token or header_token != cookie_token:
        raise HTTPException(
          status_code=status.HTTP_403_FORBIDDEN,
          detail="CSRF validation failed",
        )

    response = await call_next(request)

    # Гарантируем наличие csrf_token cookie в ответе
    csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
    if not csrf_cookie:
      csrf_cookie = secrets.token_urlsafe(32)
      cookie_kwargs = {
        "key": CSRF_COOKIE_NAME,
        "value": csrf_cookie,
        "httponly": False,  # Должен быть доступен JS, чтобы отправить в заголовке
        "secure": ENVIRONMENT == "production",
        "samesite": "Lax",
      }
      # В development: domain=localhost, чтобы cookie была видна с фронта на другом порту (5173)
      if ENVIRONMENT != "production":
        cookie_kwargs["domain"] = "localhost"
      response.set_cookie(**cookie_kwargs)

    return response

