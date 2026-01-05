"""API endpoints для получения достопримечательностей из Википедии"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
import logging

from models.user import User
from models.attraction import Attraction
from core.dependencies import get_current_active_user
from services.wikipedia_service import WikipediaService

logger = logging.getLogger(__name__)


def create_wikipedia_attractions_endpoints(app, wikipedia_service: WikipediaService):
    """Создать эндпоинты для работы с достопримечательностями из Википедии"""
    
    @app.get("/attractions/wikipedia", response_model=List[Attraction])
    async def get_wikipedia_attractions(
        city: str = Query(..., description="Название города"),
        country: Optional[str] = Query(None, description="Название страны"),
        limit: int = Query(20, ge=1, le=50, description="Максимальное количество результатов"),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить достопримечательности для города из Википедии"""
        try:
            attractions_data = await wikipedia_service.search_attractions(city, country, limit)
            
            # Преобразуем в формат Attraction
            attractions = []
            for item in attractions_data:
                # Сохраняем изображение и URL в description для передачи на фронтенд
                description = item.get("description", "")
                image_url = item.get("image_url", "")
                page_url = item.get("url", "")
                
                # Добавляем информацию об изображении и URL в конец описания
                # Фронтенд будет парсить эти данные
                full_description = description
                if image_url:
                    full_description += f"\n\n[IMAGE_URL:{image_url}]"
                if page_url:
                    full_description += f"\n[PAGE_URL:{page_url}]"
                
                attractions.append(Attraction(
                    name=item.get("name", "Без названия"),
                    description=full_description,
                    category=item.get("category"),
                    latitude=item.get("latitude"),
                    longitude=item.get("longitude"),
                    rating=None  # Википедия не предоставляет рейтинги
                ))
            
            return attractions
        except Exception as e:
            logger.error(f"Error getting Wikipedia attractions: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting Wikipedia attractions"
            )
    
    @app.get("/attractions/wikipedia/{title:path}")
    async def get_wikipedia_attraction_detail(
        title: str,
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить полное описание достопримечательности из Википедии"""
        try:
            # Декодируем название статьи (может быть URL-encoded)
            import urllib.parse
            title = urllib.parse.unquote(title)
            
            detail = await wikipedia_service.get_full_description(title)
            
            if not detail:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Attraction not found"
                )
            
            return detail
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting Wikipedia attraction detail: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting Wikipedia attraction detail"
            )

