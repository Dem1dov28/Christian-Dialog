from typing import Optional
from fastapi import Depends, HTTPException, status, BackgroundTasks
from sqlmodel import Session, select
from datetime import datetime
from pydantic import BaseModel
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

from models.user import User
from core.dependencies import get_current_active_user, get_session

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


def send_support_email(support_data: dict, user: User):
    """Фоновая задача для отправки запроса в поддержку на почту"""
    try:
        # Получаем настройки из переменных окружения
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("REPORT_SENDER_EMAIL")
        sender_password = os.getenv("REPORT_SENDER_PASSWORD")
        recipient_email = os.getenv("REPORT_RECIPIENT_EMAIL")
        
        if not all([sender_email, sender_password, recipient_email]):
            logger.warning("SMTP settings not configured. Skipping email notification.")
            return
        
        # Создаем сообщение
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = recipient_email
        msg['Subject'] = f"[Поддержка] {support_data.get('subject', 'Новый запрос')}"
        
        # Формируем тело письма
        body = f"""
Получен новый запрос в службу поддержки:

Пользователь: {user.full_name or user.username or user.email}
Email: {user.email}
ID пользователя: {user.id}

Категория: {support_data.get('category', 'Не указана')}

Тема: {support_data.get('subject', 'Без темы')}

Сообщение:
{support_data.get('message', '')}

Дата: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        """
        
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # Отправляем письмо
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, recipient_email, text)
        server.quit()
        
        logger.info(f"Support email sent successfully to {recipient_email}")
        
    except Exception as e:
        logger.error(f"Failed to send support email: {e}", exc_info=True)


def create_support_endpoints(app, db_session: Session = Depends(get_session)):
    """Создает эндпоинты для работы с запросами в поддержку"""
    
    @app.post("/api/support", response_model=SupportResponse)
    async def create_support_request(
        support_data: SupportRequest,
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Создать новый запрос в службу поддержки"""
        try:
            # Отправляем письмо в фоне
            background_tasks.add_task(send_support_email, support_data.dict(), current_user)
            
            # Логируем успешное создание
            logger.info(f"Support request created for user {current_user.id}: {support_data.subject}")
            
            # Возвращаем успешный ответ
            return SupportResponse(
                id=1,  # Можно заменить на реальный ID из БД
                user_id=current_user.id,
                subject=support_data.subject,
                message=support_data.message,
                category=support_data.category,
                created_at=datetime.now(),
                status="sent"
            )
            
        except Exception as e:
            logger.error(f"Error creating support request: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось отправить запрос в службу поддержки"
            )
    
    @app.get("/api/support", response_model=list[SupportResponse])
    async def get_user_support_requests(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Получить все запросы текущего пользователя в поддержку"""
        # Пока возвращаем пустой список, можно расширить модель в БД
        return []
    
    @app.get("/api/support/{request_id}", response_model=SupportResponse)
    async def get_support_request(
        request_id: int,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Получить конкретный запрос по ID"""
        # Пока возвращаем заглушку
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос не найден"
        )