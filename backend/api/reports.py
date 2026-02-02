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

# Модель для создания жалобы
class ReportCreate(BaseModel):
    message_id: Optional[int] = None
    text: str
    chat_id: Optional[int] = None
    category: Optional[str] = None

# Модель для ответа о жалобе
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

def send_report_email(report_data: dict, user: User):
    """Фоновая задача для отправки жалобы на почту"""
    try:
        # Получаем настройки из переменных окружения
        smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        sender_email = os.getenv("REPORT_SENDER_EMAIL")
        sender_password = os.getenv("REPORT_SENDER_PASSWORD")
        recipient_email = os.getenv("REPORT_RECIPIENT_EMAIL")
        
        if not all([sender_email, sender_password, recipient_email]):
            logger.warning("SMTP settings not configured for reports. Skipping email notification.")
            return
        
        # Создаем сообщение
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = recipient_email
        msg['Subject'] = f"[Жалоба] {report_data.get('category', 'Новая жалоба')}"
        
        # Формируем тело письма
        body = f"""
Получена новая жалоба от пользователя:

Пользователь: {user.full_name or user.username or user.email}
Email: {user.email}
ID пользователя: {user.id}

Категория: {report_data.get('category', 'Не указана')}
ID чата: {report_data.get('chat_id', 'Не указан')}
ID сообщения: {report_data.get('message_id', 'Не указано')}

Текст жалобы:
{report_data.get('text', '')}

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
        
        logger.info(f"Report email sent successfully to {recipient_email}")
        
    except Exception as e:
        logger.error(f"Failed to send report email: {e}", exc_info=True)

# Создание эндпоинтов для reports
def create_reports_endpoints(app):
    @app.post("/api/reports", response_model=ReportResponse)
    async def create_report(
        report_data: ReportCreate,
        background_tasks: BackgroundTasks,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """
        Создание жалобы на сообщение/чат
        """
        try:
            # Проверяем, что текст жалобы не пустой
            if not report_data.text or not report_data.text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Текст жалобы не может быть пустым"
                )
            
            # Проверяем, существует ли сообщение (если указан message_id)
            if report_data.message_id:
                from models.message import Message
                message_statement = select(Message).where(Message.id == report_data.message_id)
                message = session.exec(message_statement).first()
                if not message:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Сообщение не найдено"
                    )
            
            # Отправляем письмо в фоне
            background_tasks.add_task(send_report_email, report_data.dict(), current_user)
            
            # Создаем объект жалобы (временно без сохранения в БД, так как нет модели Report)
            report_response = ReportResponse(
                id=1,  # Временный ID
                message_id=report_data.message_id,
                text=report_data.text,
                chat_id=report_data.chat_id,
                category=report_data.category,
                user_id=current_user.id,
                created_at=datetime.utcnow()
            )
            
            logger.info(f"Report created by user {current_user.id} and email task added")
            
            return report_response
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Внутренняя ошибка сервера при создании жалобы"
            )
        
    @app.get("/api/reports", response_model=list[ReportResponse])
    async def get_reports(
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """
        Получение всех жалоб пользователя
        """
        try:
            # Временно возвращаем пустой список, так как модель Report не реализована
            return []
        except Exception as e:
            logger.error(f"Error getting reports: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Внутренняя ошибка сервера при получении жалоб"
            )
        
    @app.get("/api/reports/{report_id}", response_model=ReportResponse)
    async def get_report(
        report_id: int,
        current_user: User = Depends(get_current_active_user),
        session: Session = Depends(get_session)
    ):
        """
        Получение конкретной жалобы по ID
        """
        try:
            # Временно возвращаем ошибку, так как модель Report не реализована
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Жалоба не найдена"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting report {report_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Внутренняя ошибка сервера при получении жалобы"
            )
