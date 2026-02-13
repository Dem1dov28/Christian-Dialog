"""Отдельный логгер для событий безопасности (подозрительные попытки входа, rate limit и т.д.)."""
import logging
from pathlib import Path
from typing import Optional, Any

# Логгер с именем "security" — пишет в logs/security.log
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.WARNING)
# Не пробрасывать в корневой логгер, чтобы не дублировать в консоль
security_logger.propagate = False

_log_dir = Path(__file__).resolve().parent.parent / "logs"
_log_file = _log_dir / "security.log"


def _ensure_handler() -> None:
    """Один раз настроить FileHandler для security.log."""
    if security_logger.handlers:
        return
    _log_dir.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(_log_file, encoding="utf-8")
    handler.setLevel(logging.WARNING)
    handler.setFormatter(
        logging.Formatter("%(asctime)s - SECURITY - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    )
    security_logger.addHandler(handler)


def log_suspicious_activity(
    event_type: str,
    user_id: Optional[int],
    ip_address: str,
    details: Optional[dict] = None,
) -> None:
    """Пишет событие безопасности в logs/security.log (без паролей и токенов)."""
    _ensure_handler()
    details = details or {}
    msg = f"{event_type} | user_id={user_id} | ip={ip_address} | {details}"
    security_logger.warning(msg)
