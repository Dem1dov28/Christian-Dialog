from fastapi import HTTPException
from typing import Optional
import re
import logging
from core.security import sanitize_input

logger = logging.getLogger(__name__)


def validate_message_content(message: Optional[str], max_length: int = 20000) -> str:
    """
    Валидировать и санитизировать содержимое сообщения
    
    Args:
        message: Сообщение для валидации
        max_length: Максимальная длина сообщения
        
    Returns:
        Валидированное и санитизированное сообщение
    """
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Санитизация ввода для защиты от XSS и инъекций
    message = sanitize_input(message.strip(), max_length=max_length)
    
    if len(message) > max_length:
        raise HTTPException(status_code=400, detail=f"Message too long (max {max_length} characters)")
    
    # Дополнительная проверка на потенциально опасные паттерны
    # (SQL инъекции уже защищены SQLModel, но дополнительная проверка не помешает)
    dangerous_patterns = ['<script', 'javascript:', 'onerror=', 'onload=']
    message_lower = message.lower()
    for pattern in dangerous_patterns:
        if pattern in message_lower:
            logger.warning(f"Potentially dangerous content detected: {pattern}")
            # Удаляем опасные паттерны вместо полного отклонения
            import re as re_module
            message = re_module.sub(re_module.escape(pattern), '', message, flags=re_module.IGNORECASE)
    
    return message


def validate_agent_id(agent_id: Optional[int]) -> int:
    """Валидировать ID агента"""
    if not agent_id or agent_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid agent ID")
    return agent_id


def validate_pagination_params(offset: int, limit: int) -> tuple[int, int]:
    """Валидировать параметры пагинации"""
    offset = max(0, offset)
    limit = min(max(1, limit), 1000)  # Увеличиваем максимум до 1000
    return offset, limit
