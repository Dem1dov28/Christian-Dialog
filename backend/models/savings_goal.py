from __future__ import annotations

"""Модели для целей накопления"""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from pydantic import BaseModel


class SavingsGoal(SQLModel, table=True):
    """Модель цели накопления"""
    __tablename__ = "savings_goals"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", index=True)
    conversation_id: Optional[int] = Field(default=None, foreign_key="conversation.id", index=True)
    
    name: str = Field(..., max_length=200, description="Название цели")
    target_amount: float = Field(..., description="Целевая сумма")
    currency: str = Field(default="USD", max_length=10, description="Валюта")
    description: Optional[str] = Field(default=None, max_length=1000, description="Описание цели")
    target_date: Optional[datetime] = Field(default=None, description="Целевая дата достижения")
    status: str = Field(default="active", max_length=20, description="Статус (active, completed, cancelled)")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class SavingsGoalCreate(BaseModel):
    conversation_id: Optional[int] = None
    name: str
    target_amount: float
    currency: str = "USD"
    description: Optional[str] = None
    target_date: Optional[datetime] = None


class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = None


class SavingsGoalPublic(BaseModel):
    id: int
    user_id: int
    conversation_id: Optional[int]
    name: str
    target_amount: float
    currency: str
    description: Optional[str]
    target_date: Optional[datetime]
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

