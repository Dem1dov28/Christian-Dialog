from __future__ import annotations

"""Модели для бюджетов"""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from pydantic import BaseModel


class Budget(SQLModel, table=True):
    """Модель бюджета"""
    __tablename__ = "budgets"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", index=True)
    conversation_id: Optional[int] = Field(default=None, foreign_key="conversation.id", index=True)
    
    amount: float = Field(..., description="Сумма бюджета")
    currency: str = Field(default="USD", max_length=10, description="Валюта")
    category: Optional[str] = Field(default=None, max_length=200, description="Категория бюджета")
    period_type: str = Field(default="monthly", max_length=20, description="Тип периода (daily, weekly, monthly, yearly)")
    start_date: Optional[datetime] = Field(default=None, description="Дата начала")
    end_date: Optional[datetime] = Field(default=None, description="Дата окончания")
    is_active: bool = Field(default=True, description="Активен ли бюджет")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class BudgetCreate(BaseModel):
    conversation_id: Optional[int] = None
    amount: float
    currency: str = "USD"
    category: Optional[str] = None
    period_type: str = "monthly"
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    period_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class BudgetPublic(BaseModel):
    id: int
    user_id: int
    conversation_id: Optional[int]
    amount: float
    currency: str
    category: Optional[str]
    period_type: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

