"""Сервис для работы с регулярными платежами"""
from typing import List, Optional
from datetime import datetime, timedelta
from sqlmodel import Session, select
import logging

from models.recurring_payment import RecurringPayment, RecurringPaymentCreate, RecurringPaymentPublic, RecurringPaymentUpdate
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class RecurringPaymentService(BaseService):
    """Сервис для управления регулярными платежами"""
    
    def create_recurring_payment(
        self,
        payment_data: RecurringPaymentCreate,
        user_id: int
    ) -> RecurringPaymentPublic:
        """Создать новый регулярный платеж"""
        try:
            with self.get_session() as session:
                payment = RecurringPayment(
                    user_id=user_id,
                    conversation_id=payment_data.conversation_id,
                    name=payment_data.name,
                    amount=payment_data.amount,
                    currency=payment_data.currency,
                    category=payment_data.category,
                    description=payment_data.description,
                    frequency=payment_data.frequency,
                    day_of_month=payment_data.day_of_month,
                    start_date=payment_data.start_date,
                    end_date=payment_data.end_date
                )
                
                session.add(payment)
                session.commit()
                session.refresh(payment)
                
                logger.info(f"Recurring payment created: id={payment.id}, user_id={user_id}")
                return RecurringPaymentPublic.from_orm(payment)
        except Exception as e:
            logger.error(f"Error creating recurring payment: {e}", exc_info=True)
            raise
    
    def get_recurring_payments(
        self,
        user_id: int,
        conversation_id: Optional[int] = None,
        is_active: Optional[bool] = True
    ) -> List[RecurringPaymentPublic]:
        """Получить список регулярных платежей"""
        try:
            with self.get_session() as session:
                query = select(RecurringPayment).where(
                    RecurringPayment.user_id == user_id,
                    RecurringPayment.is_deleted == False
                )
                
                if conversation_id is not None:
                    query = query.where(RecurringPayment.conversation_id == conversation_id)
                
                if is_active is not None:
                    query = query.where(RecurringPayment.is_active == is_active)
                
                query = query.order_by(RecurringPayment.created_at.desc())
                
                payments = session.exec(query).all()
                return [RecurringPaymentPublic.from_orm(p) for p in payments]
        except Exception as e:
            logger.error(f"Error getting recurring payments: {e}", exc_info=True)
            return []
    
    def get_recurring_payment(self, payment_id: int, user_id: int) -> Optional[RecurringPaymentPublic]:
        """Получить регулярный платеж по ID"""
        try:
            with self.get_session() as session:
                payment = session.exec(
                    select(RecurringPayment).where(
                        RecurringPayment.id == payment_id,
                        RecurringPayment.user_id == user_id,
                        RecurringPayment.is_deleted == False
                    )
                ).first()
                
                if not payment:
                    return None
                
                return RecurringPaymentPublic.from_orm(payment)
        except Exception as e:
            logger.error(f"Error getting recurring payment {payment_id}: {e}", exc_info=True)
            return None
    
    def update_recurring_payment(
        self,
        payment_id: int,
        user_id: int,
        update_data: RecurringPaymentUpdate
    ) -> Optional[RecurringPaymentPublic]:
        """Обновить регулярный платеж"""
        try:
            with self.get_session() as session:
                payment = session.exec(
                    select(RecurringPayment).where(
                        RecurringPayment.id == payment_id,
                        RecurringPayment.user_id == user_id,
                        RecurringPayment.is_deleted == False
                    )
                ).first()
                
                if not payment:
                    return None
                
                if update_data.name is not None:
                    payment.name = update_data.name
                if update_data.amount is not None:
                    payment.amount = update_data.amount
                if update_data.currency is not None:
                    payment.currency = update_data.currency
                if update_data.category is not None:
                    payment.category = update_data.category
                if update_data.description is not None:
                    payment.description = update_data.description
                if update_data.frequency is not None:
                    payment.frequency = update_data.frequency
                if update_data.day_of_month is not None:
                    payment.day_of_month = update_data.day_of_month
                if update_data.start_date is not None:
                    payment.start_date = update_data.start_date
                if update_data.end_date is not None:
                    payment.end_date = update_data.end_date
                if update_data.is_active is not None:
                    payment.is_active = update_data.is_active
                
                payment.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(payment)
                
                logger.info(f"Recurring payment updated: id={payment_id}, user_id={user_id}")
                return RecurringPaymentPublic.from_orm(payment)
        except Exception as e:
            logger.error(f"Error updating recurring payment {payment_id}: {e}", exc_info=True)
            raise
    
    def delete_recurring_payment(self, payment_id: int, user_id: int) -> bool:
        """Удалить регулярный платеж (мягкое удаление)"""
        try:
            with self.get_session() as session:
                payment = session.exec(
                    select(RecurringPayment).where(
                        RecurringPayment.id == payment_id,
                        RecurringPayment.user_id == user_id,
                        RecurringPayment.is_deleted == False
                    )
                ).first()
                
                if not payment:
                    return False
                
                payment.is_deleted = True
                payment.updated_at = datetime.utcnow()
                
                session.commit()
                return True
        except Exception as e:
            logger.error(f"Error deleting recurring payment {payment_id}: {e}", exc_info=True)
            return False

