from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from enum import Enum


class ConversationType(str, Enum):
    """Тип группового чата"""
    AGENTS_ONLY = "agents_only"  # Только агенты


class MultiAgentConversationBase(SQLModel):
    title: str | None = None
    description: str | None = None
    group_avatar: str | None = Field(
        default="group",
        description="Имя иконки (avatar) для группового чата",
        max_length=32,
    )
    group_avatar_url: str | None = Field(
        default=None,
        description="URL загруженного аватара для группового чата (только для Plus/Pro)",
    )
    conversation_type: str | None = Field(
        default="agents_only",
        description="Тип чата: 'agents_only' (только агенты/персонажи)",
        max_length=20,
    )


class MultiAgentConversation(MultiAgentConversationBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")  # Добавляем привязку к пользователю
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    unread_count: int = Field(
        default=0, description="Количество непрочитанных сообщений"
    )
    
    # Связи с агентами
    agents: List["ConversationAgent"] = Relationship(back_populates="conversation")
    # Связи с сообщениями
    messages: List["Message"] = Relationship(back_populates="multi_agent_conversation")


class MultiAgentConversationPublic(MultiAgentConversationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    unread_count: int = 0
    group_avatar_url: str | None = None


class MultiAgentConversationCreate(MultiAgentConversationBase):
    agent_ids: List[int] = Field(default_factory=list, description="Список ID агентов (персонажей)")


class ConversationAgentBase(SQLModel):
    conversation_id: int = Field(foreign_key="multiagentconversation.id")
    agent_id: int = Field(foreign_key="agent.id")
    is_active: bool = Field(default=True)


class ConversationAgent(ConversationAgentBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Связи
    conversation: Optional["MultiAgentConversation"] = Relationship(back_populates="agents")
    agent: Optional["Agent"] = Relationship(back_populates="multi_agent_conversations")


class ConversationAgentPublic(ConversationAgentBase):
    id: int
    added_at: datetime
    agent: Optional["AgentPublic"] = None


class ConversationAgentCreate(ConversationAgentBase):
    pass


