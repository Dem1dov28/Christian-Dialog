from __future__ import annotations

"""Модели для посещений достопримечательностей"""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from pydantic import BaseModel


class AttractionVisit(SQLModel, table=True):
    """Модель посещения достопримечательности"""
    __tablename__ = "attraction_visits"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", index=True)
    trip_id: Optional[int] = Field(default=None, foreign_key="trips.id", index=True, description="ID поездки, если посещение в рамках поездки")
    travel_id: Optional[int] = Field(default=None, index=True, description="ID метки путешествия, если привязано к метке (модель удалена)")
    
    # Информация о достопримечательности
    name: str = Field(..., max_length=500, description="Название достопримечательности")
    description: Optional[str] = Field(default=None, max_length=2000, description="Описание")
    category: Optional[str] = Field(default=None, max_length=200, description="Категория (исторические, природные, развлечения, музеи и т.д.)")
    
    # Локация
    city: Optional[str] = Field(default=None, max_length=200, description="Город")
    country: Optional[str] = Field(default=None, max_length=200, description="Страна")
    latitude: Optional[float] = Field(default=None, description="Широта")
    longitude: Optional[float] = Field(default=None, description="Долгота")
    
    # Информация о посещении
    visit_date: Optional[datetime] = Field(default=None, description="Дата посещения")
    rating: Optional[float] = Field(default=None, description="Рейтинг пользователя (1-5)")
    notes: Optional[str] = Field(default=None, max_length=2000, description="Заметки о посещении")
    photos: Optional[str] = Field(default=None, max_length=5000, description="JSON массив URL фотографий")
    
    # Статус
    is_visited: bool = Field(default=False, description="Посещено ли место")
    is_planned: bool = Field(default=False, description="Запланировано ли посещение")
    
    # Дополнительная информация из API
    external_id: Optional[str] = Field(default=None, max_length=200, description="ID из внешнего API (например, OpenTripMap xid)")
    opening_hours: Optional[str] = Field(default=None, max_length=500, description="Часы работы")
    entrance_fee: Optional[str] = Field(default=None, max_length=200, description="Стоимость входа")
    visit_duration: Optional[int] = Field(default=None, description="Среднее время посещения в минутах")
    
    # Системные поля
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Дата создания")
    updated_at: Optional[datetime] = Field(default=None, description="Дата обновления")
    is_deleted: bool = Field(default=False, description="Помечено как удаленное")


class AttractionVisitCreate(BaseModel):
    """Модель для создания посещения достопримечательности"""
    trip_id: Optional[int] = None
    travel_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    visit_date: Optional[datetime] = None
    rating: Optional[float] = None
    notes: Optional[str] = None
    photos: Optional[str] = None
    is_visited: bool = False
    is_planned: bool = False
    external_id: Optional[str] = None
    opening_hours: Optional[str] = None
    entrance_fee: Optional[str] = None
    visit_duration: Optional[int] = None


class AttractionVisitPublic(BaseModel):
    """Публичная модель посещения достопримечательности для API"""
    id: int
    user_id: int
    trip_id: Optional[int]
    travel_id: Optional[int]
    name: str
    description: Optional[str]
    category: Optional[str]
    city: Optional[str]
    country: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    visit_date: Optional[datetime]
    rating: Optional[float]
    notes: Optional[str]
    photos: Optional[str]
    is_visited: bool
    is_planned: bool
    external_id: Optional[str]
    opening_hours: Optional[str]
    entrance_fee: Optional[str]
    visit_duration: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class AttractionVisitUpdate(BaseModel):
    """Модель для обновления посещения достопримечательности"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    visit_date: Optional[datetime] = None
    rating: Optional[float] = None
    notes: Optional[str] = None
    photos: Optional[str] = None
    is_visited: Optional[bool] = None
    is_planned: Optional[bool] = None
    external_id: Optional[str] = None
    opening_hours: Optional[str] = None
    entrance_fee: Optional[str] = None
    visit_duration: Optional[int] = None

