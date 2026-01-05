from __future__ import annotations

"""Модели для поездок (трипов) пользователя"""
from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel


class Trip(SQLModel, table=True):
    """Модель поездки (трипа) - группирует несколько посещений"""
    __tablename__ = "trips"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", index=True)
    
    # Основная информация о поездке
    title: str = Field(..., max_length=200, description="Название поездки (например, 'Поездка в Рим, май 2024')")
    description: Optional[str] = Field(default=None, max_length=2000, description="Описание поездки")
    
    # Даты поездки
    start_date: Optional[datetime] = Field(default=None, description="Дата начала поездки")
    end_date: Optional[datetime] = Field(default=None, description="Дата окончания поездки")
    
    # Основная локация поездки
    main_city: Optional[str] = Field(default=None, max_length=200, description="Основной город поездки")
    main_country: Optional[str] = Field(default=None, max_length=200, description="Основная страна поездки")
    
    # Системные поля
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Дата создания")
    updated_at: Optional[datetime] = Field(default=None, description="Дата обновления")
    is_deleted: bool = Field(default=False, description="Помечено как удаленное")
    
    # Связи (будут добавлены через Relationship если нужно)
    # attraction_visits: List["AttractionVisit"] = Relationship(back_populates="trip")


class TripCreate(BaseModel):
    """Модель для создания поездки"""
    title: str
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    main_city: Optional[str] = None
    main_country: Optional[str] = None


class TripPublic(BaseModel):
    """Публичная модель поездки для API"""
    id: int
    user_id: int
    title: str
    description: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    main_city: Optional[str]
    main_country: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class TripUpdate(BaseModel):
    """Модель для обновления поездки"""
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    main_city: Optional[str] = None
    main_country: Optional[str] = None



