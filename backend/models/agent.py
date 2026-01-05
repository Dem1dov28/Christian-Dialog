from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import JSON
from typing import List, Optional, Union


class AgentBase(SQLModel):
    name: str = Field(index=True)
    instructions: str
    model: str
    category: Optional[str] = Field(default="general", description="Категория агента")
    image_url: Optional[str] = Field(default=None, description="URL изображения агента")
    description: Optional[str] = Field(default=None, description="Описание агента")
    system_prompt: Optional[str] = Field(default=None, description="Системный промпт агента")
    color_class: Optional[str] = Field(default="bg-blue-500", description="CSS класс для цвета")
    icon_name: Optional[str] = Field(default="psychology", description="Название иконки")
    avatar_url: Optional[str] = Field(default=None, description="URL аватара агента")
    temperature: Optional[float] = Field(default=0.7, description="Температура для генерации")
    max_tokens: Optional[int] = Field(default=None, description="Максимальное количество токенов")
    is_active: bool = Field(default=True, description="Активен ли агент")
    available_models: Optional[List[str]] = Field(default=None, sa_column=Column(JSON), description="Список доступных моделей для этого агента")


class Agent(AgentBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Связи
    conversations: List["Conversation"] = Relationship()
    multi_agent_conversations: List["ConversationAgent"] = Relationship(back_populates="agent")
    messages: List["Message"] = Relationship(back_populates="agent")
    test_answers: List["TestAnswer"] = Relationship(back_populates="agent")


class AgentPublic(AgentBase):
    id: int
    created_at: datetime


class AgentCreate(AgentBase):
    pass


class AgentUpdate(SQLModel):
    """Модель для частичного обновления агента"""
    name: Optional[str] = None
    instructions: Optional[str] = None
    model: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color_class: Optional[str] = None
    icon_name: Optional[str] = None
    avatar_url: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None
    available_models: Optional[List[str]] = None