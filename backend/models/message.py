from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from pydantic import BaseModel
from typing import Optional, List


class MessageBase(SQLModel):
    content: str
    is_from_user: bool = Field(default=True)  # True если от пользователя, False если от агента
    # Для обычных чатов с одним агентом
    conversation_id: Optional[int] = Field(default=None, foreign_key="conversation.id")
    # Для многопользовательских чатов
    multi_agent_conversation_id: Optional[int] = Field(default=None, foreign_key="multiagentconversation.id")
    # ID агента, который отправил сообщение (для многопользовательских чатов)
    agent_id: Optional[int] = Field(default=None, foreign_key="agent.id")
    # Новые поля для функционала чата
    is_pinned: bool = Field(default=False)  # Закреплено ли сообщение
    reply_to_message_id: Optional[int] = Field(default=None, foreign_key="message.id")  # ID сообщения, на которое отвечаем
    is_deleted: bool = Field(default=False)  # Удалено ли сообщение (мягкое удаление)
    
    
    # Валидация: сообщение должно принадлежать либо обычному чату, либо многопользовательскому
    def __init__(self, **data):
        super().__init__(**data)
        # Проверяем, что указан хотя бы один ID разговора
        if not self.conversation_id and not self.multi_agent_conversation_id:
            raise ValueError("Message must belong to either a conversation or multi-agent conversation")


class Message(MessageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Связи
    conversation: Optional["Conversation"] = Relationship(back_populates="messages")
    multi_agent_conversation: Optional["MultiAgentConversation"] = Relationship()
    agent: Optional["Agent"] = Relationship(back_populates="messages")
    file_attachments: List["FileAttachment"] = Relationship(back_populates="message")


class MessagePublic(MessageBase):
    id: int
    created_at: datetime
    agent_name: Optional[str] = None


class MessageCreate(MessageBase):
    pass


# Модель для отправки сообщения агенту
class ChatMessage(BaseModel):
    agent_id: int
    message: str
    conversation_id: Optional[int] = None  # Добавляем conversation_id


# Модель для отправки сообщения в многопользовательский чат
class MultiAgentChatMessage(BaseModel):
    conversation_id: str  # Изменено на str для совместимости с frontend
    message: str
    sender_agent_id: Optional[int] = None  # Если None, то сообщение от пользователя
    language: Optional[str] = None  # Язык для ответа агентов (ru, en)
