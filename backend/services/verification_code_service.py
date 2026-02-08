import random
import string
from datetime import datetime, timedelta
from typing import Optional
from sqlmodel import Session, select
from core.database import engine
from models.verification_code import VerificationCode, VerifyCodeRequest, VerifyCodeResponse
from services.base_service import BaseService
from services.email_service import email_service
import logging

logger = logging.getLogger(__name__)

class VerificationCodeService(BaseService):
    def __init__(self):
        super().__init__()
        self.session = Session(engine)
        
    def generate_verification_code(self) -> str:
        return ''.join(random.choices(string.digits, k=6))
    
    def send_verification_code(self, email: str) -> bool:
        try:
            code = self.generate_verification_code()
            self.cleanup_old_codes(email)
            expires_at = datetime.utcnow() + timedelta(minutes=15)
            
            verification_code = VerificationCode(
                email=email,
                code=code,
                expires_at=expires_at
            )
            
            with self.get_session() as session:
                session.add(verification_code)
                session.commit()
                session.refresh(verification_code)
            
            subject = "Код подтверждения для сброса пароля"
            body = f"""
Ваш код подтверждения: {code}

Используйте этот код для сброса пароля на сайте EpochalDialog.
Код действителен в течение 15 минут.

Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.
"""
            
            success = email_service.send_email(subject, body, email)
            
            if success:
                logger.info(f"Verification code sent to {email}")
            else:
                logger.error(f"Failed to send verification code to {email}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error sending verification code to {email}: {str(e)}")
            return False
    
    def send_registration_code(self, email: str) -> bool:
        """Send verification code for registration"""
        try:
            code = self.generate_verification_code()
            self.cleanup_old_codes(email)
            expires_at = datetime.utcnow() + timedelta(minutes=15)
            
            verification_code = VerificationCode(
                email=email,
                code=code,
                expires_at=expires_at
            )
            
            with self.get_session() as session:
                session.add(verification_code)
                session.commit()
                session.refresh(verification_code)
            
            subject = "Код подтверждения для регистрации"
            body = f"""
Ваш код подтверждения: {code}

Используйте этот код для завершения регистрации на сайте EpochalDialog.
Код действителен в течение 15 минут.

Если вы не регистрировались на нашем сайте, проигнорируйте это сообщение.
"""
            
            success = email_service.send_email(subject, body, email)
            
            if success:
                logger.info(f"Registration verification code sent to {email}")
            else:
                logger.error(f"Failed to send registration verification code to {email}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error sending registration verification code to {email}: {str(e)}")
            return False
    
    def verify_code(self, email: str, code: str) -> VerifyCodeResponse:
        try:
            with self.get_session() as session:
                statement = select(VerificationCode).where(
                    VerificationCode.email == email,
                    VerificationCode.code == code,
                    VerificationCode.is_used == False,
                    VerificationCode.expires_at > datetime.utcnow()
                )
                
                verification_code = session.exec(statement).first()
                
                if not verification_code:
                    return VerifyCodeResponse(
                        success=False,
                        message="Неверный или просроченный код"
                    )
                
                verification_code.is_used = True
                verification_code.used_at = datetime.utcnow()
                session.add(verification_code)
                session.commit()
                
                return VerifyCodeResponse(
                    success=True,
                    message="Код успешно подтвержден",
                    token="temp_token_for_password_reset"
                )
                
        except Exception as e:
            logger.error(f"Error verifying code for {email}: {str(e)}")
            return VerifyCodeResponse(
                success=False,
                message="Ошибка при проверке кода"
            )
    
    def cleanup_old_codes(self, email: Optional[str] = None):
        try:
            with self.get_session() as session:
                statement = select(VerificationCode)
                
                if email:
                    statement = statement.where(VerificationCode.email == email)
                
                codes = session.exec(statement).all()
                
                now = datetime.utcnow()
                deleted_count = 0
                
                for code_record in codes:
                    if code_record.is_used or code_record.expires_at < now:
                        session.delete(code_record)
                        deleted_count += 1
                
                if deleted_count > 0:
                    session.commit()
                    logger.info(f"Cleaned up {deleted_count} old verification codes")
                    
        except Exception as e:
            logger.error(f"Error cleaning up old codes: {str(e)}")

verification_code_service = VerificationCodeService()
