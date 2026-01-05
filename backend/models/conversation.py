from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
import json


class ConversationBase(SQLModel):
    agent_id: int | None = Field(
        default=None,
        foreign_key="agent.id",
        description="ID агента (персонажа)"
    )
    title: str | None = None
    user_id: int = Field(
        foreign_key="user.id", description="ID пользователя, создавшего разговор"
    )
    is_system_chat: bool = Field(
        default=False, description="Системный чат (например, Saved Messages)"
    )
    conversation_type: str | None = Field(
        default="agents_only",
        description="Тип чата: 'agents_only' (только персонаж)",
        max_length=20,
    )
    selected_model: str | None = Field(
        default=None,
        description="Выбранная модель для этого чата (если None, используется модель агента)"
    )


class Conversation(ConversationBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    unread_count: int = Field(
        default=0, description="Количество непрочитанных сообщений"
    )

    # Атрибуты каналов
    is_channel: bool = Field(
        default=False, description="Признак публичного канала (глобальный чат без ИИ)"
    )
    is_listed: bool = Field(
        default=True,
        description="Показывать ли канал в публичных списках (скрытые каналы недоступны пользователям)",
    )
    channel_owner_id: int | None = Field(
        default=None,
        foreign_key="user.id",
        description="Владелец канала, единственный кто может публиковать сообщения",
    )
    channel_description: str | None = Field(
        default=None, description="Описание канала, отображаемое пользователям"
    )
    frozen_at: datetime | None = Field(
        default=None,
        description="Метка времени перевода канала в режим только для чтения",
    )

    # Поле для закрепленных сообщений (JSON строка с массивом ID сообщений)
    pinned_messages: str = Field(
        default="[]", description="JSON строка с ID закрепленных сообщений"
    )

    # Поле для правил пользователя (JSON строка с массивом правил)
    user_rules: str = Field(
        default="[]", description="JSON строка с правилами пользователя для агента"
    )

    # Связи
    messages: List["Message"] = Relationship(back_populates="conversation")
    test_answers: List["TestAnswer"] = Relationship(back_populates="conversation")
    file_attachments: List["FileAttachment"] = Relationship(
        back_populates="conversation"
    )

    def get_pinned_messages(self) -> List[int]:
        """Получить список ID закрепленных сообщений"""
        try:
            return json.loads(self.pinned_messages) if self.pinned_messages else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_pinned_messages(self, message_ids: List[int]) -> None:
        """Установить список ID закрепленных сообщений"""
        self.pinned_messages = json.dumps(message_ids)

    def add_pinned_message(self, message_id: int) -> bool:
        """Добавить сообщение в закрепленные"""
        pinned = self.get_pinned_messages()
        if message_id not in pinned:
            pinned.append(message_id)
            self.set_pinned_messages(pinned)
            return True
        return False

    def remove_pinned_message(self, message_id: int) -> bool:
        """Удалить сообщение из закрепленных"""
        # Убеждаемся, что message_id является числом
        try:
            message_id = int(message_id)
        except (ValueError, TypeError):
            return False

        pinned = self.get_pinned_messages()

        if message_id in pinned:
            pinned.remove(message_id)
            self.set_pinned_messages(pinned)
            return True
        return False

    def is_message_pinned(self, message_id: int) -> bool:
        """Проверить, закреплено ли сообщение"""
        return message_id in self.get_pinned_messages()

    def toggle_pinned_message(self, message_id: int) -> bool:
        """Переключить состояние закрепления сообщения"""
        if self.is_message_pinned(message_id):
            return self.remove_pinned_message(message_id)
        else:
            return self.add_pinned_message(message_id)

    def get_user_rules(self) -> List[str]:
        """Получить список правил пользователя"""
        try:
            return json.loads(self.user_rules) if self.user_rules else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_user_rules(self, rules: List[str]) -> None:
        """Установить список правил пользователя"""
        # Фильтруем пустые правила и сохраняем как JSON
        filtered_rules = [rule.strip() for rule in rules if rule and rule.strip()]
        self.user_rules = json.dumps(filtered_rules, ensure_ascii=False)

    def is_frozen(self) -> bool:
        """Проверить, переведен ли канал в режим только для чтения."""
        return bool(self.frozen_at)


class ConversationPublic(ConversationBase):
    id: int
    created_at: datetime
    updated_at: datetime | None = None
    is_system_chat: bool
    is_channel: bool | None = None
    is_listed: bool | None = None
    channel_owner_id: int | None = None
    channel_description: str | None = None
    frozen_at: datetime | None = None
    unread_count: int = 0
    selected_model: str | None = None


class ConversationCreate(ConversationBase):
    pass


