"""Сервис для работы с посещениями достопримечательностей"""
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select
import logging

from models.attraction_visit import (
    AttractionVisit, 
    AttractionVisitCreate, 
    AttractionVisitPublic, 
    AttractionVisitUpdate
)
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class AttractionVisitService(BaseService):
    """Сервис для управления посещениями достопримечательностей"""
    
    def create_attraction_visit(
        self, 
        visit_data: AttractionVisitCreate, 
        user_id: int
    ) -> AttractionVisitPublic:
        """Создать новое посещение достопримечательности
        
        Args:
            visit_data: Данные посещения
            user_id: ID пользователя
            
        Returns:
            Созданное посещение
        """
        try:
            with self.get_session() as session:
                visit = AttractionVisit(
                    user_id=user_id,
                    trip_id=visit_data.trip_id,
                    travel_id=visit_data.travel_id,
                    name=visit_data.name,
                    description=visit_data.description,
                    category=visit_data.category,
                    city=visit_data.city,
                    country=visit_data.country,
                    latitude=visit_data.latitude,
                    longitude=visit_data.longitude,
                    visit_date=visit_data.visit_date,
                    rating=visit_data.rating,
                    notes=visit_data.notes,
                    photos=visit_data.photos,
                    is_visited=visit_data.is_visited,
                    is_planned=visit_data.is_planned,
                    external_id=visit_data.external_id,
                    opening_hours=visit_data.opening_hours,
                    entrance_fee=visit_data.entrance_fee,
                    visit_duration=visit_data.visit_duration
                )
                
                session.add(visit)
                session.commit()
                session.refresh(visit)
                
                logger.info(f"AttractionVisit created: id={visit.id}, user_id={user_id}, name={visit.name}")
                
                return AttractionVisitPublic.model_validate(visit)
        except Exception as e:
            logger.error(f"Error creating attraction visit: {e}", exc_info=True)
            raise
    
    def get_attraction_visits(
        self, 
        user_id: int,
        trip_id: Optional[int] = None,
        travel_id: Optional[int] = None,
        is_visited: Optional[bool] = None,
        is_planned: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
        include_deleted: bool = False
    ) -> List[AttractionVisitPublic]:
        """Получить список посещений достопримечательностей
        
        Args:
            user_id: ID пользователя
            trip_id: Фильтр по ID поездки
            travel_id: Фильтр по ID метки путешествия
            is_visited: Фильтр по статусу посещения
            is_planned: Фильтр по статусу планирования
            limit: Максимальное количество записей
            offset: Смещение для пагинации
            include_deleted: Включать ли удаленные посещения
            
        Returns:
            Список посещений
        """
        try:
            with self.get_session() as session:
                query = select(AttractionVisit).where(AttractionVisit.user_id == user_id)
                
                if trip_id is not None:
                    query = query.where(AttractionVisit.trip_id == trip_id)
                
                if travel_id is not None:
                    query = query.where(AttractionVisit.travel_id == travel_id)
                
                if is_visited is not None:
                    query = query.where(AttractionVisit.is_visited == is_visited)
                
                if is_planned is not None:
                    query = query.where(AttractionVisit.is_planned == is_planned)
                
                if not include_deleted:
                    query = query.where(AttractionVisit.is_deleted == False)
                
                query = query.order_by(
                    AttractionVisit.visit_date.desc() if AttractionVisit.visit_date 
                    else AttractionVisit.created_at.desc()
                )
                query = query.offset(offset).limit(limit)
                
                visits = session.exec(query).all()
                
                return [AttractionVisitPublic.model_validate(visit) for visit in visits]
        except Exception as e:
            logger.error(f"Error getting attraction visits: {e}", exc_info=True)
            raise
    
    def get_attraction_visit(
        self, 
        visit_id: int, 
        user_id: int
    ) -> Optional[AttractionVisitPublic]:
        """Получить посещение по ID
        
        Args:
            visit_id: ID посещения
            user_id: ID пользователя
            
        Returns:
            Посещение или None
        """
        try:
            with self.get_session() as session:
                visit = session.exec(
                    select(AttractionVisit).where(
                        AttractionVisit.id == visit_id,
                        AttractionVisit.user_id == user_id,
                        AttractionVisit.is_deleted == False
                    )
                ).first()
                
                if not visit:
                    return None
                
                return AttractionVisitPublic.model_validate(visit)
        except Exception as e:
            logger.error(f"Error getting attraction visit: {e}", exc_info=True)
            raise
    
    def update_attraction_visit(
        self, 
        visit_id: int, 
        visit_data: AttractionVisitUpdate, 
        user_id: int
    ) -> Optional[AttractionVisitPublic]:
        """Обновить посещение достопримечательности
        
        Args:
            visit_id: ID посещения
            visit_data: Данные для обновления
            user_id: ID пользователя
            
        Returns:
            Обновленное посещение или None
        """
        try:
            with self.get_session() as session:
                visit = session.exec(
                    select(AttractionVisit).where(
                        AttractionVisit.id == visit_id,
                        AttractionVisit.user_id == user_id,
                        AttractionVisit.is_deleted == False
                    )
                ).first()
                
                if not visit:
                    return None
                
                # Обновляем поля
                update_data = visit_data.model_dump(exclude_unset=True)
                for field, value in update_data.items():
                    setattr(visit, field, value)
                
                visit.updated_at = datetime.utcnow()
                
                session.add(visit)
                session.commit()
                session.refresh(visit)
                
                logger.info(f"AttractionVisit updated: id={visit.id}, user_id={user_id}")
                
                return AttractionVisitPublic.model_validate(visit)
        except Exception as e:
            logger.error(f"Error updating attraction visit: {e}", exc_info=True)
            raise
    
    def delete_attraction_visit(
        self, 
        visit_id: int, 
        user_id: int
    ) -> bool:
        """Удалить посещение (мягкое удаление)
        
        Args:
            visit_id: ID посещения
            user_id: ID пользователя
            
        Returns:
            True если удалено, False если не найдено
        """
        try:
            with self.get_session() as session:
                visit = session.exec(
                    select(AttractionVisit).where(
                        AttractionVisit.id == visit_id,
                        AttractionVisit.user_id == user_id,
                        AttractionVisit.is_deleted == False
                    )
                ).first()
                
                if not visit:
                    return False
                
                visit.is_deleted = True
                visit.updated_at = datetime.utcnow()
                
                session.add(visit)
                session.commit()
                
                logger.info(f"AttractionVisit deleted: id={visit.id}, user_id={user_id}")
                
                return True
        except Exception as e:
            logger.error(f"Error deleting attraction visit: {e}", exc_info=True)
            raise



