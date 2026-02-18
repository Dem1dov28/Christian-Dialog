import os
import smtplib
import ssl
import time
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

try:
    import resend
    _RESEND_AVAILABLE = True
except ImportError:
    _RESEND_AVAILABLE = False


class EmailService:
    """
    Отправка писем: при наличии RESEND_API_KEY — через Resend (HTTPS, работает при заблокированном SMTP),
    иначе через SMTP (Gmail и др.).
    """
    
    def __init__(self):
        self.resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.resend_from = os.getenv("RESEND_FROM", "").strip()
        self.resend_reply_to = os.getenv("RESEND_REPLY_TO", "").strip()
        self.use_resend = bool(self.resend_api_key and _RESEND_AVAILABLE)
        if self.use_resend and not self.resend_from:
            self.resend_from = "Epochal Dialog <onboarding@resend.dev>"
            logger.warning("RESEND_FROM not set, using onboarding@resend.dev (Resend does not allow From: @gmail.com; use verified domain or leave empty)")
        
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.sender_email = os.getenv("REPORT_SENDER_EMAIL")
        self.sender_password = os.getenv("REPORT_SENDER_PASSWORD")
        self.recipient_email = os.getenv("REPORT_RECIPIENT_EMAIL")
        self.context = ssl.create_default_context()

    def send_email(self, subject: str, body: str, recipient: Optional[str] = None) -> bool:
        """Отправляет email: через Resend (HTTPS), если настроен, иначе через SMTP."""
        target_recipient = recipient or self.recipient_email
        if not target_recipient:
            logger.error("No recipient email defined.")
            return False
        if self.use_resend:
            return self._send_via_resend(subject, body, target_recipient)
        return self._send_via_smtp(subject, body, target_recipient)

    def _send_via_resend(self, subject: str, body: str, recipient: str) -> bool:
        """Отправка через Resend API (HTTPS, порт 443 — не блокируется хостингами)."""
        try:
            resend.api_key = self.resend_api_key
            from_addr = self.resend_from
            if from_addr and "<" not in from_addr and ">" not in from_addr:
                from_addr = f"Epochal Dialog <{from_addr}>"
            params = {
                "from": from_addr or "Epochal Dialog <onboarding@resend.dev>",
                "to": [recipient],
                "subject": subject,
                "text": body,
            }
            if self.resend_reply_to:
                params["reply_to"] = self.resend_reply_to
            resend.Emails.send(params)
            logger.info("Email sent successfully via Resend (HTTPS)")
            return True
        except Exception as e:
            logger.exception("Resend send failed: %s", e)
            return False

    def _send_via_smtp(self, subject: str, body: str, recipient: str) -> bool:
        """Отправка через SMTP (Gmail и др.)."""
        if not all([self.sender_email, self.sender_password]):
            logger.error("Email configuration missing: sender email or password not set.")
            return False
        message = MIMEMultipart()
        message["From"] = self.sender_email
        message["To"] = recipient
        message["Subject"] = subject
        message.attach(MIMEText(body, "plain", "utf-8"))
        connection_attempts = [(465, True), (587, False)]
        if self.smtp_port not in [465, 587]:
            connection_attempts.insert(0, (self.smtp_port, False))
        max_retries = 2
        for port, use_ssl in connection_attempts:
            for retry in range(max_retries):
                try:
                    logger.info("Connecting to %s:%s (SSL: %s, attempt: %s)...", self.smtp_server, port, use_ssl, retry + 1)
                    if use_ssl:
                        with smtplib.SMTP_SSL(self.smtp_server, port, context=self.context, timeout=60) as server:
                            server.login(self.sender_email, self.sender_password)
                            server.send_message(message)
                    else:
                        with smtplib.SMTP(self.smtp_server, port, timeout=60) as server:
                            server.ehlo()
                            if server.has_extn("STARTTLS"):
                                server.starttls(context=self.context)
                                server.ehlo()
                            server.login(self.sender_email, self.sender_password)
                            server.send_message(message)
                    logger.info("Email sent successfully via SMTP port %s", port)
                    return True
                except Exception as e:
                    logger.warning("Failed to send via port %s attempt %s: %s", port, retry + 1, e)
                    if retry < max_retries - 1:
                        time.sleep(2)
        logger.error("All SMTP attempts to send email to %s failed.", recipient)
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
