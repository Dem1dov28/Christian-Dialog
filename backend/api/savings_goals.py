"""API endpoints для работы с целями накопления"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
from sqlmodel import Session
import logging

from models.user import User
from models.savings_goal import SavingsGoalCreate, SavingsGoalPublic, SavingsGoalUpdate
from core.database import get_session
from core.dependencies import get_current_active_user
from services.savings_goal_service import SavingsGoalService

logger = logging.getLogger(__name__)


def create_savings_goal_endpoints(app, savings_goal_service: SavingsGoalService):
    """Создать эндпоинты для работы с целями накопления"""
    
    @app.post("/savings-goals", response_model=SavingsGoalPublic, status_code=status.HTTP_201_CREATED)
    async def create_savings_goal(
        goal_data: SavingsGoalCreate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создать новую цель накопления"""
        try:
            goal = savings_goal_service.create_goal(goal_data, current_user.id)
            logger.info(f"Savings goal created: id={goal.id}, user_id={current_user.id}")
            return goal
        except ValueError as e:
            logger.warning(f"Validation error creating savings goal: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating savings goal: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating savings goal"
            )
    
    @app.get("/savings-goals", response_model=List[SavingsGoalPublic])
    async def get_savings_goals(
        conversation_id: Optional[int] = Query(None, description="ID разговора для фильтрации"),
        status: Optional[str] = Query(None, description="Фильтр по статусу"),
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить список целей накопления"""
        try:
            goals = savings_goal_service.get_goals(
                user_id=current_user.id,
                conversation_id=conversation_id,
                status=status
            )
            logger.info(f"Retrieved {len(goals)} savings goals for user {current_user.id}")
            return goals
        except Exception as e:
            logger.error(f"Error getting savings goals: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting savings goals"
            )
    
    @app.get("/savings-goals/{goal_id}", response_model=SavingsGoalPublic)
    async def get_savings_goal(
        goal_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить цель накопления по ID"""
        try:
            goal = savings_goal_service.get_goal(goal_id, current_user.id)
            if not goal:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Savings goal not found"
                )
            return goal
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting savings goal {goal_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting savings goal"
            )
    
    @app.put("/savings-goals/{goal_id}", response_model=SavingsGoalPublic)
    async def update_savings_goal(
        goal_id: int,
        update_data: SavingsGoalUpdate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Обновить цель накопления"""
        try:
            goal = savings_goal_service.update_goal(goal_id, current_user.id, update_data)
            if not goal:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Savings goal not found"
                )
            logger.info(f"Savings goal updated: id={goal_id}, user_id={current_user.id}")
            return goal
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Validation error updating savings goal {goal_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating savings goal {goal_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating savings goal"
            )
    
    @app.delete("/savings-goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_savings_goal(
        goal_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Удалить цель накопления"""
        try:
            success = savings_goal_service.delete_goal(goal_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Savings goal not found"
                )
            logger.info(f"Savings goal deleted: id={goal_id}, user_id={current_user.id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting savings goal {goal_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting savings goal"
            )

