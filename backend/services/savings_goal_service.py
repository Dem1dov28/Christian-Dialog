"""Сервис для работы с целями накопления"""
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select
import logging

from models.savings_goal import SavingsGoal, SavingsGoalCreate, SavingsGoalPublic, SavingsGoalUpdate
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class SavingsGoalService(BaseService):
    """Сервис для управления целями накопления"""
    
    def create_goal(
        self,
        goal_data: SavingsGoalCreate,
        user_id: int
    ) -> SavingsGoalPublic:
        """Создать новую цель"""
        try:
            with self.get_session() as session:
                goal = SavingsGoal(
                    user_id=user_id,
                    conversation_id=goal_data.conversation_id,
                    name=goal_data.name,
                    target_amount=goal_data.target_amount,
                    currency=goal_data.currency,
                    description=goal_data.description,
                    target_date=goal_data.target_date
                )
                
                session.add(goal)
                session.commit()
                session.refresh(goal)
                
                logger.info(f"Savings goal created: id={goal.id}, user_id={user_id}")
                return SavingsGoalPublic.from_orm(goal)
        except Exception as e:
            logger.error(f"Error creating savings goal: {e}", exc_info=True)
            raise
    
    def get_goals(
        self,
        user_id: int,
        conversation_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> List[SavingsGoalPublic]:
        """Получить список целей"""
        try:
            with self.get_session() as session:
                query = select(SavingsGoal).where(
                    SavingsGoal.user_id == user_id,
                    SavingsGoal.is_deleted == False
                )
                
                if conversation_id is not None:
                    query = query.where(SavingsGoal.conversation_id == conversation_id)
                
                if status is not None:
                    query = query.where(SavingsGoal.status == status)
                
                query = query.order_by(SavingsGoal.created_at.desc())
                
                goals = session.exec(query).all()
                return [SavingsGoalPublic.from_orm(g) for g in goals]
        except Exception as e:
            logger.error(f"Error getting savings goals: {e}", exc_info=True)
            return []
    
    def get_goal(self, goal_id: int, user_id: int) -> Optional[SavingsGoalPublic]:
        """Получить цель по ID"""
        try:
            with self.get_session() as session:
                goal = session.exec(
                    select(SavingsGoal).where(
                        SavingsGoal.id == goal_id,
                        SavingsGoal.user_id == user_id,
                        SavingsGoal.is_deleted == False
                    )
                ).first()
                
                if not goal:
                    return None
                
                return SavingsGoalPublic.from_orm(goal)
        except Exception as e:
            logger.error(f"Error getting savings goal {goal_id}: {e}", exc_info=True)
            return None
    
    def update_goal(
        self,
        goal_id: int,
        user_id: int,
        update_data: SavingsGoalUpdate
    ) -> Optional[SavingsGoalPublic]:
        """Обновить цель"""
        try:
            with self.get_session() as session:
                goal = session.exec(
                    select(SavingsGoal).where(
                        SavingsGoal.id == goal_id,
                        SavingsGoal.user_id == user_id,
                        SavingsGoal.is_deleted == False
                    )
                ).first()
                
                if not goal:
                    return None
                
                if update_data.name is not None:
                    goal.name = update_data.name
                if update_data.target_amount is not None:
                    goal.target_amount = update_data.target_amount
                if update_data.current_amount is not None:
                    goal.current_amount = update_data.current_amount
                    # Проверяем, достигнута ли цель
                    if goal.current_amount >= goal.target_amount and goal.status == "active":
                        goal.status = "completed"
                        goal.completed_at = datetime.utcnow()
                if update_data.currency is not None:
                    goal.currency = update_data.currency
                if update_data.description is not None:
                    goal.description = update_data.description
                if update_data.target_date is not None:
                    goal.target_date = update_data.target_date
                if update_data.status is not None:
                    goal.status = update_data.status
                    if update_data.status == "completed" and not goal.completed_at:
                        goal.completed_at = datetime.utcnow()
                
                goal.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(goal)
                
                logger.info(f"Savings goal updated: id={goal_id}, user_id={user_id}")
                return SavingsGoalPublic.from_orm(goal)
        except Exception as e:
            logger.error(f"Error updating savings goal {goal_id}: {e}", exc_info=True)
            raise
    
    def delete_goal(self, goal_id: int, user_id: int) -> bool:
        """Удалить цель (мягкое удаление)"""
        try:
            with self.get_session() as session:
                goal = session.exec(
                    select(SavingsGoal).where(
                        SavingsGoal.id == goal_id,
                        SavingsGoal.user_id == user_id,
                        SavingsGoal.is_deleted == False
                    )
                ).first()
                
                if not goal:
                    return False
                
                goal.is_deleted = True
                goal.updated_at = datetime.utcnow()
                
                session.commit()
                return True
        except Exception as e:
            logger.error(f"Error deleting savings goal {goal_id}: {e}", exc_info=True)
            return False

