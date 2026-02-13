"""Monitoring and error tracking integration (Sentry or similar).

Подключается опционально через переменную окружения SENTRY_DSN.
Если DSN не задан или пакет sentry_sdk не установлен, модуль не влияет на поведение приложения.
"""

from __future__ import annotations

import logging
import os

from config import ENVIRONMENT

logger = logging.getLogger(__name__)


def init_sentry(app_name: str = "epochal-dialog-backend") -> None:
    """Инициализация Sentry, если указан SENTRY_DSN и установлен sentry-sdk."""
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        logger.info("Sentry DSN не задан, мониторинг ошибок не активирован")
        return

    try:
        import sentry_sdk  # type: ignore
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration  # type: ignore
    except ImportError:
        logger.warning(
            "SENTRY_DSN задан, но пакет sentry-sdk не установлен. "
            "Установите: pip install sentry-sdk[fastapi]"
        )
        return

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=ENVIRONMENT,
            release=app_name,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
            traces_sample_rate=0.1 if ENVIRONMENT == "production" else 0.0,
            profiles_sample_rate=0.1 if ENVIRONMENT == "production" else 0.0,
            send_default_pii=False,
        )
        logger.info("Sentry успешно инициализирован")
    except Exception as exc:  # pragma: no cover
        logger.error("Не удалось инициализировать Sentry: %s", exc)

