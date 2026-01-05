"""API endpoints для работы с поездками (трипами)"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
from sqlmodel import Session
import logging

from models.user import User
from models.trip import TripCreate, TripPublic, TripUpdate
from core.database import get_session
from core.dependencies import get_current_active_user
from services.trip_service import TripService

logger = logging.getLogger(__name__)


def create_trip_endpoints(app, trip_service: TripService):
    """Создать эндпоинты для работы с поездками"""
    
    @app.post("/trips", response_model=TripPublic, status_code=status.HTTP_201_CREATED)
    async def create_trip(
        trip_data: TripCreate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создать новую поездку"""
        try:
            trip = trip_service.create_trip(trip_data, current_user.id)
            logger.info(f"Trip created: id={trip.id}, user_id={current_user.id}")
            return trip
        except ValueError as e:
            logger.warning(f"Validation error creating trip: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating trip: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating trip"
            )
    
    @app.get("/trips", response_model=List[TripPublic])
    async def get_trips(
        limit: int = Query(100, ge=1, le=500, description="Максимальное количество записей"),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        include_deleted: bool = Query(False, description="Включать ли удаленные поездки"),
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить список поездок пользователя"""
        try:
            trips = trip_service.get_trips(
                user_id=current_user.id,
                limit=limit,
                offset=offset,
                include_deleted=include_deleted
            )
            logger.info(f"Retrieved {len(trips)} trips for user {current_user.id}")
            return trips
        except Exception as e:
            logger.error(f"Error getting trips: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting trips"
            )
    
    @app.get("/trips/{trip_id}", response_model=TripPublic)
    async def get_trip(
        trip_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить поездку по ID"""
        try:
            trip = trip_service.get_trip(trip_id, current_user.id)
            if not trip:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Trip not found"
                )
            return trip
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting trip: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting trip"
            )
    
    @app.put("/trips/{trip_id}", response_model=TripPublic)
    async def update_trip(
        trip_id: int,
        trip_data: TripUpdate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Обновить поездку"""
        try:
            trip = trip_service.update_trip(trip_id, trip_data, current_user.id)
            if not trip:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Trip not found"
                )
            logger.info(f"Trip updated: id={trip_id}, user_id={current_user.id}")
            return trip
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating trip: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating trip"
            )
    
    @app.delete("/trips/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_trip(
        trip_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Удалить поездку"""
        try:
            deleted = trip_service.delete_trip(trip_id, current_user.id)
            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Trip not found"
                )
            logger.info(f"Trip deleted: id={trip_id}, user_id={current_user.id}")
            return None
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting trip: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting trip"
            )



