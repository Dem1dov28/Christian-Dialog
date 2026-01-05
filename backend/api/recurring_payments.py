"""API endpoints для работы с регулярными платежами"""
from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
from sqlmodel import Session
import logging

from models.user import User
from models.recurring_payment import RecurringPaymentCreate, RecurringPaymentPublic, RecurringPaymentUpdate
from core.database import get_session
from core.dependencies import get_current_active_user
from services.recurring_payment_service import RecurringPaymentService

logger = logging.getLogger(__name__)


def create_recurring_payment_endpoints(app, recurring_payment_service: RecurringPaymentService):
    """Создать эндпоинты для работы с регулярными платежами"""
    
    @app.post("/recurring-payments", response_model=RecurringPaymentPublic, status_code=status.HTTP_201_CREATED)
    async def create_recurring_payment(
        payment_data: RecurringPaymentCreate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создать новый регулярный платеж"""
        try:
            payment = recurring_payment_service.create_recurring_payment(payment_data, current_user.id)
            logger.info(f"Recurring payment created: id={payment.id}, user_id={current_user.id}")
            return payment
        except ValueError as e:
            logger.warning(f"Validation error creating recurring payment: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating recurring payment: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating recurring payment"
            )
    
    @app.get("/recurring-payments", response_model=List[RecurringPaymentPublic])
    async def get_recurring_payments(
        conversation_id: Optional[int] = Query(None, description="ID разговора для фильтрации"),
        is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить список регулярных платежей"""
        try:
            payments = recurring_payment_service.get_recurring_payments(
                user_id=current_user.id,
                conversation_id=conversation_id,
                is_active=is_active
            )
            logger.info(f"Retrieved {len(payments)} recurring payments for user {current_user.id}")
            return payments
        except Exception as e:
            logger.error(f"Error getting recurring payments: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting recurring payments"
            )
    
    @app.get("/recurring-payments/{payment_id}", response_model=RecurringPaymentPublic)
    async def get_recurring_payment(
        payment_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Получить регулярный платеж по ID"""
        try:
            payment = recurring_payment_service.get_recurring_payment(payment_id, current_user.id)
            if not payment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recurring payment not found"
                )
            return payment
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting recurring payment {payment_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting recurring payment"
            )
    
    @app.put("/recurring-payments/{payment_id}", response_model=RecurringPaymentPublic)
    async def update_recurring_payment(
        payment_id: int,
        update_data: RecurringPaymentUpdate,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Обновить регулярный платеж"""
        try:
            payment = recurring_payment_service.update_recurring_payment(
                payment_id, current_user.id, update_data
            )
            if not payment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recurring payment not found"
                )
            logger.info(f"Recurring payment updated: id={payment_id}, user_id={current_user.id}")
            return payment
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Validation error updating recurring payment {payment_id}: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error updating recurring payment {payment_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error updating recurring payment"
            )
    
    @app.delete("/recurring-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
    async def delete_recurring_payment(
        payment_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Удалить регулярный платеж"""
        try:
            success = recurring_payment_service.delete_recurring_payment(payment_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recurring payment not found"
                )
            logger.info(f"Recurring payment deleted: id={payment_id}, user_id={current_user.id}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting recurring payment {payment_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error deleting recurring payment"
            )

