"""API endpoints для работы с бюджетами"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
from sqlmodel import Session
import logging

from models.user import User
from models.budget import BudgetCreate, BudgetPublic, BudgetUpdate
from core.database import get_session
from core.dependencies import get_current_active_user
from services.budget_service import BudgetService

logger = logging.getLogger(__name__)


def create_budget_endpoints(app, budget_service: BudgetService):
    """Создать эндпоинты для работы с бюджетами"""
    
    @app.post("/budgets", response_model=BudgetPublic, status_code=status.HTTP_201_CREATED)
    async def create_budget(
        budget_data: BudgetCreate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создать новый бюджет"""
        try:
            budget = budget_service.create_budget(budget_data, current_user.id)
            logger.info(f"Budget created: id={budget.id}, user_id={current_user.id}")
            return budget
        except ValueError as e:
            logger.warning(f"Validation error creating budget: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating budget: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating budget"
            )
    
    @app.get("/budgets", response_model=List[BudgetPublic])
    async def get_budgets(
        conversation_id: Optional[int] = Query(None, description="ID разговора для фильтрации"),
        is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить список бюджетов"""
        try:
            budgets = budget_service.get_budgets(
                user_id=current_user.id,
                conversation_id=conversation_id,
                is_active=is_active
            )
            logger.info(f"Retrieved {len(budgets)} budgets for user {current_user.id}")
            return budgets
        except Exception as e:
            logger.error(f"Error getting budgets: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting budgets"
            )
    
    @app.get("/budgets/{budget_id}", response_model=BudgetPublic)
    async def get_budget(
        budget_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить бюджет по ID"""
        try:
            budget = budget_service.get_budget(budget_id, current_user.id)
            if not budget:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Budget not found"
                )
            return budget
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting budget {budget_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting budget"
            )
    
    @app.put("/budgets/{budget_id}", response_model=BudgetPublic)
    async def update_budget(
        budget_id: int,
        update_data: BudgetUpdate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Обновить бюджет"""
        try:
            budget = budget_service.update_budget(budget_id, current_user.id, update_data)
            if not budget:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Budget not found"
                )
            logger.info(f"Budget updated: id={budget_id}, user_id={current_user.id}")
            return budget
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Validation error updating budget {budget_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating budget {budget_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating budget"
            )
    
    @app.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_budget(
        budget_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Удалить бюджет"""
        try:
            success = budget_service.delete_budget(budget_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Budget not found"
                )
            logger.info(f"Budget deleted: id={budget_id}, user_id={current_user.id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting budget {budget_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting budget"
            )
    
    @app.get("/budgets/{budget_id}/status")
    async def get_budget_status(
        budget_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить статус бюджета с текущими расходами"""
        try:
            status_data = budget_service.get_budget_status(budget_id, current_user.id)
            if not status_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Budget not found"
                )
            return status_data
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting budget status {budget_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting budget status"
            )

