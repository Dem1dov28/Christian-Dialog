"""API endpoints для работы с посещениями достопримечательностей"""
from typing import List, Optional, Union
from fastapi import Depends, HTTPException, Query, status
from sqlmodel import Session
import logging

from models.user import User
from models.attraction_visit import (
    AttractionVisitCreate, 
    AttractionVisitPublic, 
    AttractionVisitUpdate
)
from core.database import get_session
from core.dependencies import get_current_active_user
from services.attraction_visit_service import AttractionVisitService

logger = logging.getLogger(__name__)


def parse_bool_param(value: Optional[Union[bool, str]]) -> Optional[bool]:
    """Конвертировать параметр в boolean"""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes", "on")
    return bool(value)


def create_attraction_visit_endpoints(app, attraction_visit_service: AttractionVisitService):
    """Создать эндпоинты для работы с посещениями достопримечательностей"""
    
    @app.post("/attraction-visits", response_model=AttractionVisitPublic, status_code=status.HTTP_201_CREATED)
    async def create_attraction_visit(
        visit_data: AttractionVisitCreate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создать новое посещение достопримечательности"""
        try:
            visit = attraction_visit_service.create_attraction_visit(visit_data, current_user.id)
            logger.info(f"AttractionVisit created: id={visit.id}, user_id={current_user.id}")
            return visit
        except ValueError as e:
            logger.warning(f"Validation error creating attraction visit: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating attraction visit: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating attraction visit"
            )
    
    @app.get("/attraction-visits", response_model=List[AttractionVisitPublic])
    async def get_attraction_visits(
        trip_id: Optional[int] = Query(None, description="Фильтр по ID поездки"),
        travel_id: Optional[int] = Query(None, description="Фильтр по ID метки путешествия"),
        is_visited: Optional[Union[bool, str]] = Query(None, description="Фильтр по статусу посещения"),
        is_planned: Optional[Union[bool, str]] = Query(None, description="Фильтр по статусу планирования"),
        limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить список посещений достопримечательностей"""
        try:
            # Конвертируем параметры в boolean
            is_visited_bool = parse_bool_param(is_visited)
            is_planned_bool = parse_bool_param(is_planned)
            
            visits = attraction_visit_service.get_attraction_visits(
                user_id=current_user.id,
                trip_id=trip_id,
                travel_id=travel_id,
                is_visited=is_visited_bool,
                is_planned=is_planned_bool,
                limit=limit,
                offset=offset
            )
            logger.info(f"Retrieved {len(visits)} attraction visits for user {current_user.id}")
            return visits
        except Exception as e:
            logger.error(f"Error getting attraction visits: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting attraction visits"
            )
    
    @app.get("/attraction-visits/{visit_id}", response_model=AttractionVisitPublic)
    async def get_attraction_visit(
        visit_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить посещение по ID"""
        try:
            visit = attraction_visit_service.get_attraction_visit(visit_id, current_user.id)
            if not visit:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Attraction visit not found"
                )
            return visit
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting attraction visit: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting attraction visit"
            )
    
    @app.put("/attraction-visits/{visit_id}", response_model=AttractionVisitPublic)
    async def update_attraction_visit(
        visit_id: int,
        visit_data: AttractionVisitUpdate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Обновить посещение достопримечательности"""
        try:
            visit = attraction_visit_service.update_attraction_visit(visit_id, visit_data, current_user.id)
            if not visit:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Attraction visit not found"
                )
            logger.info(f"AttractionVisit updated: id={visit_id}, user_id={current_user.id}")
            return visit
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating attraction visit: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating attraction visit"
            )
    
    @app.delete("/attraction-visits/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_attraction_visit(
        visit_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Удалить посещение достопримечательности"""
        try:
            deleted = attraction_visit_service.delete_attraction_visit(visit_id, current_user.id)
            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Attraction visit not found"
                )
            logger.info(f"AttractionVisit deleted: id={visit_id}, user_id={current_user.id}")
            return None
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting attraction visit: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting attraction visit"
            )

