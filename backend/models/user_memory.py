"""Модель памяти агента о пользователе — важные факты для персонализации диалога."""

from datetime import datetime
from sqlmodel import Field, SQLModel
from typing import Optional


# Категории памяти для группировки фактов
USER_MEMORY_TYPES = (
    "bio",               # Биографические факты (имя, возраст, профессия, семья)
    "communication",     # Манера общения (формальность, юмор, предпочтения)
    "philosophy",        # Философские взгляды, ценности, убеждения
    "interests",         # Интересы, хобби
    "preferences",       # Предпочтения (любимое, нелюбимое)
    "other",             # Прочее
)


class UserMemoryBase(SQLModel):
    """Базовая модель факта о пользователе."""
    user_id: int = Field(foreign_key="user.id", index=True)
    agent_id: int = Field(foreign_key="agent.id", index=True)
    memory_type: str = Field(
        default="other",
        max_length=32,
        description="Тип: bio, communication, philosophy, interests, preferences, other"
    )
    content: str = Field(description="Краткое описание факта")
    importance: float = Field(
        default=0.5,
        ge=0,
        le=1,
        description="Важность (0–1), выше — чаще используется в контексте"
    )
    # Уникальность по content для пары user+agent (дедупликация)
    source_message_id: Optional[int] = Field(
        default=None,
        foreign_key="message.id",
        description="ID сообщения, из которого извлекли факт"
    )


class UserMemory(UserMemoryBase, table=True):
    """Таблица фактов о пользователе для персонализации ответов агента."""
    __tablename__ = "user_memory"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserMemoryCreate(UserMemoryBase):
    pass


class UserMemoryPublic(UserMemoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
