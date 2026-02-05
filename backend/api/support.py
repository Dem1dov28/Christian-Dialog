from datetime import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session
from pydantic import BaseModel
import logging

from models.user import User
from core.dependencies import get_current_active_user, get_session
from services.email_service import email_service

logger = logging.getLogger(__name__)

class SupportRequest(BaseModel):
    subject: str
    message: str
    category: Optional[str] = None

class SupportResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    message: str
    category: Optional[str]
    created_at: datetime
    status: str

def send_support_background(support_data: dict, user: User):
    """Фоновая задача для отправки запроса в поддержку"""
    user_info = {
        "name": user.full_name or user.username or "Unknown",
        "email": user.email,
        "id": user.id
    }
    
    subject = f"[Поддержка] {support_data.get('category', 'Запрос')}: {support_data.get('subject')}"
    body = email_service.format_support_body(user_info, support_data)
    
    email_service.send_email(subject, body)

def create_support_endpoints(app):
    """Инициализация эндпоинтов службы поддержки"""
    
    @app.post("/api/support", response_model=SupportResponse)
    async def create_support_request(
        support_data: SupportRequest,
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_active_user),
    ):
        """Создать новый запрос в службу поддержки"""
        try:
            # Отправляем email в фоне используя EmailService
            background_tasks.add_task(send_support_background, support_data.dict(), current_user)
            
            logger.info(f"Support request received from user {current_user.id}")
            
            return SupportResponse(
                id=1, # Заглушка так как нет таблицы в БД
                user_id=current_user.id,
                subject=support_data.subject,
                message=support_data.message,
                category=support_data.category,
                created_at=datetime.utcnow(),
                status="sent"
            )
        except Exception as e:
            logger.error(f"Error processing support request: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Внутренняя ошибка при обработке запроса"
            )

    @app.get("/api/support", response_model=List[SupportResponse])
    async def get_user_support_requests(
        current_user: User = Depends(get_current_active_user),
    ):
        """Получить список запросов пользователя (заглушка)"""
        return []

    @app.get("/api/support/{request_id}", response_model=SupportResponse)
    async def get_support_request(
        request_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        """Получить детали запроса (заглушка)"""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос не найден"
        )