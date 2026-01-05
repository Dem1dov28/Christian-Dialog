"""Сервис для работы с поездками (трипами)"""
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select
import logging

from models.trip import Trip, TripCreate, TripPublic, TripUpdate
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class TripService(BaseService):
    """Сервис для управления поездками пользователя"""
    
    def create_trip(
        self, 
        trip_data: TripCreate, 
        user_id: int
    ) -> TripPublic:
        """Создать новую поездку
        
        Args:
            trip_data: Данные поездки
            user_id: ID пользователя
            
        Returns:
            Созданная поездка
        """
        try:
            with self.get_session() as session:
                trip = Trip(
                    user_id=user_id,
                    title=trip_data.title,
                    description=trip_data.description,
                    start_date=trip_data.start_date,
                    end_date=trip_data.end_date,
                    main_city=trip_data.main_city,
                    main_country=trip_data.main_country
                )
                
                session.add(trip)
                session.commit()
                session.refresh(trip)
                
                logger.info(f"Trip created: id={trip.id}, user_id={user_id}, title={trip.title}")
                
                return TripPublic.model_validate(trip)
        except Exception as e:
            logger.error(f"Error creating trip: {e}", exc_info=True)
            raise
    
    def get_trips(
        self, 
        user_id: int, 
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False
    ) -> List[TripPublic]:
        """Получить список поездок пользователя
        
        Args:
            user_id: ID пользователя
            limit: Максимальное количество записей
            offset: Смещение для пагинации
            include_deleted: Включать ли удаленные поездки
            
        Returns:
            Список поездок
        """
        try:
            with self.get_session() as session:
                query = select(Trip).where(Trip.user_id == user_id)
                
                if not include_deleted:
                    query = query.where(Trip.is_deleted == False)
                
                query = query.order_by(Trip.start_date.desc() if Trip.start_date else Trip.created_at.desc())
                query = query.offset(offset).limit(limit)
                
                trips = session.exec(query).all()
                
                return [TripPublic.model_validate(trip) for trip in trips]
        except Exception as e:
            logger.error(f"Error getting trips: {e}", exc_info=True)
            raise
    
    def get_trip(
        self, 
        trip_id: int, 
        user_id: int
    ) -> Optional[TripPublic]:
        """Получить поездку по ID
        
        Args:
            trip_id: ID поездки
            user_id: ID пользователя
            
        Returns:
            Поездка или None
        """
        try:
            with self.get_session() as session:
                trip = session.exec(
                    select(Trip).where(
                        Trip.id == trip_id,
                        Trip.user_id == user_id,
                        Trip.is_deleted == False
                    )
                ).first()
                
                if not trip:
                    return None
                
                return TripPublic.model_validate(trip)
        except Exception as e:
            logger.error(f"Error getting trip: {e}", exc_info=True)
            raise
    
    def update_trip(
        self, 
        trip_id: int, 
        trip_data: TripUpdate, 
        user_id: int
    ) -> Optional[TripPublic]:
        """Обновить поездку
        
        Args:
            trip_id: ID поездки
            trip_data: Данные для обновления
            user_id: ID пользователя
            
        Returns:
            Обновленная поездка или None
        """
        try:
            with self.get_session() as session:
                trip = session.exec(
                    select(Trip).where(
                        Trip.id == trip_id,
                        Trip.user_id == user_id,
                        Trip.is_deleted == False
                    )
                ).first()
                
                if not trip:
                    return None
                
                # Обновляем поля
                update_data = trip_data.model_dump(exclude_unset=True)
                for field, value in update_data.items():
                    setattr(trip, field, value)
                
                trip.updated_at = datetime.utcnow()
                
                session.add(trip)
                session.commit()
                session.refresh(trip)
                
                logger.info(f"Trip updated: id={trip.id}, user_id={user_id}")
                
                return TripPublic.model_validate(trip)
        except Exception as e:
            logger.error(f"Error updating trip: {e}", exc_info=True)
            raise
    
    def delete_trip(
        self, 
        trip_id: int, 
        user_id: int
    ) -> bool:
        """Удалить поездку (мягкое удаление)
        
        Args:
            trip_id: ID поездки
            user_id: ID пользователя
            
        Returns:
            True если удалено, False если не найдено
        """
        try:
            with self.get_session() as session:
                trip = session.exec(
                    select(Trip).where(
                        Trip.id == trip_id,
                        Trip.user_id == user_id,
                        Trip.is_deleted == False
                    )
                ).first()
                
                if not trip:
                    return False
                
                trip.is_deleted = True
                trip.updated_at = datetime.utcnow()
                
                session.add(trip)
                session.commit()
                
                logger.info(f"Trip deleted: id={trip.id}, user_id={user_id}")
                
                return True
        except Exception as e:
            logger.error(f"Error deleting trip: {e}", exc_info=True)
            raise



