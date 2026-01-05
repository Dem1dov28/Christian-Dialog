"""API endpoints для геокодинга"""
from typing import Optional
from fastapi import Depends, HTTPException, Query, status
import logging

from models.user import User
from core.dependencies import get_current_active_user
from services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)


def create_geocoding_endpoints(app, geocoding_service: GeocodingService):
    """Создать эндпоинты для геокодинга"""
    
    @app.get("/geocoding/reverse")
    async def reverse_geocode(
        latitude: float = Query(..., description="Широта"),
        longitude: float = Query(..., description="Долгота"),
        current_user: User = Depends(get_current_active_user)
    ):
        """Обратный геокодинг: получить адрес по координатам"""
        try:
            result = await geocoding_service.reverse_geocode(latitude, longitude)
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Location not found"
                )
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in reverse geocoding: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error in reverse geocoding"
            )
    
    @app.get("/geocoding/search")
    async def geocode_search(
        query: str = Query(..., description="Название места"),
        limit: int = Query(1, ge=1, le=10, description="Максимальное количество результатов"),
        current_user: User = Depends(get_current_active_user)
    ):
        """Прямой геокодинг: получить координаты по названию места"""
        try:
            results = await geocoding_service.geocode(query, limit)
            return results
        except Exception as e:
            logger.error(f"Error in geocoding search: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error in geocoding search"
            )



