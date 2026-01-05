"""Модель для достопримечательности"""
from typing import Optional
from pydantic import BaseModel


class Attraction(BaseModel):
    """Модель достопримечательности (для API ответов)"""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    external_id: Optional[str] = None
    opening_hours: Optional[str] = None
    entrance_fee: Optional[str] = None
    rating: Optional[float] = None
    images: Optional[list] = None

