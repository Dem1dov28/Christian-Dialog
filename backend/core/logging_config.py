"""Настройка логирования: фильтр чувствительных данных."""
import logging
import re
from typing import Any


class SensitiveDataFilter(logging.Filter):
    """Фильтр для маскировки паролей, токенов и секретов в сообщениях логов."""

    SENSITIVE_PATTERNS = [
        (re.compile(r'password["\']?\s*[:=]\s*["\']?[^"\'}\s]+', re.IGNORECASE), "password=***"),
        (re.compile(r'token["\']?\s*[:=]\s*["\']?[^"\'}\s]+', re.IGNORECASE), "token=***"),
        (re.compile(r'api[_-]?key["\']?\s*[:=]\s*["\']?[^"\'}\s]+', re.IGNORECASE), "api_key=***"),
        (re.compile(r'secret["\']?\s*[:=]\s*["\']?[^"\'}\s]+', re.IGNORECASE), "secret=***"),
        (re.compile(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*'), "Bearer ***"),
        (re.compile(r'Authorization:\s*Bearer\s+[A-Za-z0-9\-._~+/]+=*', re.IGNORECASE), "Authorization: ***"),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        """Подменяет чувствительные фрагменты в record.msg и record.args перед выводом."""
        try:
            message = record.getMessage()
            for pattern, replacement in self.SENSITIVE_PATTERNS:
                message = pattern.sub(replacement, message)
            # Меняем сообщение, чтобы хендлеры выводили уже отфильтрованное
            record.msg = message
            record.args = ()
        except Exception:
            pass
        return True


def setup_sensitive_data_filter() -> None:
    """Вешает SensitiveDataFilter на корневой логгер (применяется ко всем логгерам)."""
    root = logging.getLogger()
    if not any(isinstance(f, SensitiveDataFilter) for f in root.filters):
        root.addFilter(SensitiveDataFilter())
