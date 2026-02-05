from datetime import datetime
from typing import Optional, List
from fastapi import Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session, select
from pydantic import BaseModel
import logging

from models.user import User
from core.dependencies import get_current_active_user, get_session
from services.email_service import email_service

logger = logging.getLogger(__name__)

class ReportCreate(BaseModel):
    message_id: Optional[int] = None
    text: str
    chat_id: Optional[int] = None
    category: Optional[str] = None

class ReportResponse(BaseModel):
    id: int
    message_id: Optional[int]
    text: str
    chat_id: Optional[int]
    category: Optional[str]
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

def send_report_background(report_data: dict, user: User):
    """Фоновая задача для отправки жалобы"""
    user_info = {
        "name": user.full_name or user.username or "Unknown",
        "email": user.email,
        "id": user.id
    }
    
    subject = f"[Жалоба] {report_data.get('category', 'Новая жалоба')}"
    body = email_service.format_report_body(user_info, report_data)
    
    email_service.send_email(subject, body)

def create_reports_endpoints(app):
    """Инициализация эндпоинтов жалоб"""
    
    @app.post("/api/reports", response_model=ReportResponse)
    async def create_report(
        report_data: ReportCreate,
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """Создание новой жалобы"""
        try:
            if not report_data.text or not report_data.text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Текст жалобы не может быть пустым"
                )

            # Проверка существования сообщения если указано
            if report_data.message_id:
                from models.message import Message
                message = session.exec(select(Message).where(Message.id == report_data.message_id)).first()
                if not message:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Сообщение не найдено"
                    )

            # Отправляем email в фоне используя EmailService
            background_tasks.add_task(send_report_background, report_data.dict(), current_user)
            
            logger.info(f"Report received from user {current_user.id}")
            
            return ReportResponse(
                id=1, # Заглушка
                message_id=report_data.message_id,
                text=report_data.text,
                chat_id=report_data.chat_id,
                category=report_data.category,
                user_id=current_user.id,
                created_at=datetime.utcnow()
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating report: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Внутренняя ошибка сервера"
            )

    @app.get("/api/reports", response_model=List[ReportResponse])
    async def get_reports(
        current_user: User = Depends(get_current_active_user),
    ):
        """Получить список жалоб (заглушка)"""
        return []

    @app.get("/api/reports/{report_id}", response_model=ReportResponse)
    async def get_report(
        report_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        """Получить детали жалобы (заглушка)"""
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Жалоба не найдена"
        )
