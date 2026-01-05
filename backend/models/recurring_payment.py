from __future__ import annotations

"""Модели для регулярных платежей"""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from pydantic import BaseModel


class RecurringPayment(SQLModel, table=True):
    """Модель регулярного платежа"""
    __tablename__ = "recurring_payments"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", index=True)
    conversation_id: Optional[int] = Field(default=None, foreign_key="conversation.id", index=True)
    
    name: str = Field(..., max_length=200, description="Название платежа")
    amount: float = Field(..., description="Сумма платежа")
    currency: str = Field(default="USD", max_length=10, description="Валюта")
    category: Optional[str] = Field(default=None, max_length=200, description="Категория")
    description: Optional[str] = Field(default=None, max_length=1000, description="Описание")
    frequency: str = Field(default="monthly", max_length=20, description="Частота (daily, weekly, monthly, yearly)")
    day_of_month: Optional[int] = Field(default=None, description="День месяца для платежа")
    start_date: Optional[datetime] = Field(default=None, description="Дата начала")
    end_date: Optional[datetime] = Field(default=None, description="Дата окончания")
    is_active: bool = Field(default=True, description="Активен ли платеж")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)


class RecurringPaymentCreate(BaseModel):
    conversation_id: Optional[int] = None
    name: str
    amount: float
    currency: str = "USD"
    category: Optional[str] = None
    description: Optional[str] = None
    frequency: str = "monthly"
    day_of_month: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class RecurringPaymentUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class RecurringPaymentPublic(BaseModel):
    id: int
    user_id: int
    conversation_id: Optional[int]
    name: str
    amount: float
    currency: str
    category: Optional[str]
    description: Optional[str]
    frequency: str
    day_of_month: Optional[int]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

