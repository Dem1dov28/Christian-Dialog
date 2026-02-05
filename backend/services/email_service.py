import os
import smtplib
import ssl
import time
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class EmailService:
    """
    Универсальный сервис для отправки Email сообщений с поддержкой TLS/SSL
    и автоматическим выбором портов.
    """
    
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("REPORT_SENDER_EMAIL")
        self.sender_password = os.getenv("REPORT_SENDER_PASSWORD")
        self.recipient_email = os.getenv("REPORT_RECIPIENT_EMAIL")
        
        # Настройка SSL контекста
        self.context = ssl.create_default_context()

    def send_email(self, subject: str, body: str, recipient: Optional[str] = None) -> bool:
        """
        Отправляет email сообщение. Пытается использовать Port 587 (TLS) и Port 465 (SSL).
        """
        if not all([self.sender_email, self.sender_password]):
            logger.error("Email configuration missing: sender email or password not set.")
            return False
            
        target_recipient = recipient or self.recipient_email
        if not target_recipient:
            logger.error("No recipient email defined.")
            return False

        # Создаем MIME сообщение
        message = MIMEMultipart()
        message["From"] = self.sender_email
        message["To"] = target_recipient
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain", "utf-8"))

        # Порядок попыток: 465 (SSL) обычно работает стабильнее при проблемах с рукопожатием.
        connection_attempts = [
            (465, True),  # SSL
            (587, False), # TLS
        ]
        
        # Если в .env указан специфичный порт, ставим его первым
        if self.smtp_port not in [465, 587]:
            connection_attempts.insert(0, (self.smtp_port, False))

        max_retries = 2
        
        for port, use_ssl in connection_attempts:
            for retry in range(max_retries):
                try:
                    logger.info(f"Connecting to {self.smtp_server}:{port} (SSL: {use_ssl}, attempt: {retry+1})...")
                    
                    if use_ssl:
                        # Подключение через SSL (Port 465)
                        # Увеличиваем таймаут до 60 секунд для медленных сетей
                        with smtplib.SMTP_SSL(self.smtp_server, port, context=self.context, timeout=60) as server:
                            # server.set_debuglevel(1) # Раскомментируйте для полной отладки в консоли
                            server.login(self.sender_email, self.sender_password)
                            server.send_message(message)
                    else:
                        # Подключение через STARTTLS (Port 587)
                        with smtplib.SMTP(self.smtp_server, port, timeout=60) as server:
                            server.ehlo()
                            if server.has_extn('STARTTLS'):
                                server.starttls(context=self.context)
                                server.ehlo()
                            server.login(self.sender_email, self.sender_password)
                            server.send_message(message)
                            
                    logger.info(f"Email sent successfully via port {port}")
                    return True
                    
                except Exception as e:
                    logger.warning(f"Failed to send via port {port} on attempt {retry+1}: {str(e)}")
                    if retry < max_retries - 1:
                        time.sleep(2)
                    continue
        
        logger.error(f"All attempts to send email to {target_recipient} failed.")
        return False

    def format_report_body(self, user_info: Dict[str, Any], report_data: Dict[str, Any]) -> str:
        """Форматирует тело письма для жалобы"""
        return f"""
НОВАЯ ЖАЛОБА
--------------------------------------------------
ОТ ПОЛЬЗОВАТЕЛЯ:
Имя: {user_info.get('name')}
Email: {user_info.get('email')}
ID: {user_info.get('id')}

ДЕТАЛИ:
Категория: {report_data.get('category', 'Не указана')}
ID чата: {report_data.get('chat_id', 'Не указан')}
ID сообщения: {report_data.get('message_id', 'Не указано')}

ТЕКСТ ЖАЛОБЫ:
{report_data.get('text', '')}

Дата: {time.strftime('%Y-%m-%d %H:%M:%S')}
--------------------------------------------------
        """

    def format_support_body(self, user_info: Dict[str, Any], support_data: Dict[str, Any]) -> str:
        """Форматирует тело письма для службы поддержки"""
        return f"""
НОВЫЙ ЗАПРОС В ПОДДЕРЖКУ
--------------------------------------------------
ОТ ПОЛЬЗОВАТЕЛЯ:
Имя: {user_info.get('name')}
Email: {user_info.get('email')}
ID: {user_info.get('id')}

ДЕТАЛИ:
Категория: {support_data.get('category', 'Не указана')}
Тема: {support_data.get('subject', 'Без темы')}

СООБЩЕНИЕ:
{support_data.get('message', '')}

Дата: {time.strftime('%Y-%m-%d %H:%M:%S')}
--------------------------------------------------
        """

# Единственный экземпляр сервиса
email_service = EmailService()
