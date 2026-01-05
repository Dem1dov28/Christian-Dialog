"""Сервис для работы с бюджетами"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlmodel import Session, select
import logging

from models.budget import Budget, BudgetCreate, BudgetPublic, BudgetUpdate
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class BudgetService(BaseService):
    """Сервис для управления бюджетами пользователя"""
    
    def create_budget(
        self,
        budget_data: BudgetCreate,
        user_id: int
    ) -> BudgetPublic:
        """Создать новый бюджет"""
        try:
            with self.get_session() as session:
                budget = Budget(
                    user_id=user_id,
                    conversation_id=budget_data.conversation_id,
                    amount=budget_data.amount,
                    currency=budget_data.currency,
                    category=budget_data.category,
                    period_type=budget_data.period_type,
                    start_date=budget_data.start_date,
                    end_date=budget_data.end_date
                )
                
                session.add(budget)
                session.commit()
                session.refresh(budget)
                
                logger.info(f"Budget created: id={budget.id}, user_id={user_id}")
                return BudgetPublic.from_orm(budget)
        except Exception as e:
            logger.error(f"Error creating budget: {e}", exc_info=True)
            raise
    
    def get_budgets(
        self,
        user_id: int,
        conversation_id: Optional[int] = None,
        is_active: Optional[bool] = True
    ) -> List[BudgetPublic]:
        """Получить список бюджетов"""
        try:
            with self.get_session() as session:
                query = select(Budget).where(
                    Budget.user_id == user_id,
                    Budget.is_deleted == False
                )
                
                if conversation_id is not None:
                    query = query.where(Budget.conversation_id == conversation_id)
                
                if is_active is not None:
                    query = query.where(Budget.is_active == is_active)
                
                query = query.order_by(Budget.created_at.desc())
                
                budgets = session.exec(query).all()
                return [BudgetPublic.from_orm(b) for b in budgets]
        except Exception as e:
            logger.error(f"Error getting budgets: {e}", exc_info=True)
            return []
    
    def get_budget(self, budget_id: int, user_id: int) -> Optional[BudgetPublic]:
        """Получить бюджет по ID"""
        try:
            with self.get_session() as session:
                budget = session.exec(
                    select(Budget).where(
                        Budget.id == budget_id,
                        Budget.user_id == user_id
                    )
                ).first()
                
                if not budget:
                    return None
                
                return BudgetPublic.from_orm(budget)
        except Exception as e:
            logger.error(f"Error getting budget {budget_id}: {e}", exc_info=True)
            return None
    
    def update_budget(
        self,
        budget_id: int,
        user_id: int,
        update_data: BudgetUpdate
    ) -> Optional[BudgetPublic]:
        """Обновить бюджет"""
        try:
            with self.get_session() as session:
                budget = session.exec(
                    select(Budget).where(
                        Budget.id == budget_id,
                        Budget.user_id == user_id
                    )
                ).first()
                
                if not budget:
                    return None
                
                if update_data.amount is not None:
                    budget.amount = update_data.amount
                if update_data.currency is not None:
                    budget.currency = update_data.currency
                if update_data.category is not None:
                    budget.category = update_data.category
                if update_data.period_type is not None:
                    budget.period_type = update_data.period_type
                if update_data.start_date is not None:
                    budget.start_date = update_data.start_date
                if update_data.end_date is not None:
                    budget.end_date = update_data.end_date
                if update_data.is_active is not None:
                    budget.is_active = update_data.is_active
                
                budget.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(budget)
                
                logger.info(f"Budget updated: id={budget_id}, user_id={user_id}")
                return BudgetPublic.from_orm(budget)
        except Exception as e:
            logger.error(f"Error updating budget {budget_id}: {e}", exc_info=True)
            raise
    
    def delete_budget(self, budget_id: int, user_id: int) -> bool:
        """Удалить бюджет (мягкое удаление)"""
        try:
            with self.get_session() as session:
                budget = session.exec(
                    select(Budget).where(
                        Budget.id == budget_id,
                        Budget.user_id == user_id
                    )
                ).first()
                
                if not budget:
                    return False
                
                session.delete(budget)
                session.commit()
                return True
        except Exception as e:
            logger.error(f"Error deleting budget {budget_id}: {e}", exc_info=True)
            return False
    
    def get_budget_status(
        self,
        budget_id: int,
        user_id: int
    ) -> Optional[Dict[str, Any]]:
        """Получить статус бюджета"""
        try:
            budget = self.get_budget(budget_id, user_id)
            if not budget:
                return None
            
            # Бюджет без отслеживания расходов (модель Purchase удалена)
            return {
                "budget": budget,
                "spent": 0.0,
                "remaining": budget.amount,
                "percentage": 0.0,
                "status": "ok",
                "purchase_count": 0
            }
        except Exception as e:
            logger.error(f"Error getting budget status {budget_id}: {e}", exc_info=True)
            return None

