from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select, func, or_, and_
from datetime import timedelta, datetime
import os
import uuid
import json
import logging
import re
from typing import Optional
from secrets import token_urlsafe
from pathlib import Path
from PIL import Image
import io

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from core.database import get_session
from core.auth import (
    authenticate_user, 
    create_user, 
    create_access_token, 
    update_user_last_login,
    get_password_hash,
    get_user_by_email,
    verify_password,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from core.dependencies import get_current_active_user
from core.user_utils import create_user_response
from services.subscription_service import SubscriptionService
from services.auth_protection_service import auth_protection_service
from models.user import (
    UserCreate, 
    UserResponse, 
    UserUpdate, 
    Token, 
    User,
    UsageStatsResponse,
    ChatExportRequest,
    ChatExportResponse,
    APIUpgradeRequest,
    APIUpgradeResponse,
    SubscriptionUpgradeRequest,
    SubscriptionUpgradeResponse,
    CheckEmailRequest,
    CheckEmailResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse
)
from models.verification_code import VerifyCodeRequest, VerifyCodeResponse, SendResetCodeRequest, ResetPasswordRequest
from models.conversation import Conversation
from models.message import Message
from models.multi_agent_conversation import MultiAgentConversation
from models.agent import Agent
from models.attraction_visit import AttractionVisit
from models.file_attachment import FileAttachment
from models.folder import Folder
from models.user_channel_subscription import UserChannelSubscription
from pydantic import BaseModel

from config import GOOGLE_ALLOWED_CLIENT_IDS, GOOGLE_CLIENT_ID

logger = logging.getLogger(__name__)




class GoogleAuthRequest(BaseModel):
    credential: str
    client_id: Optional[str] = None


def _is_local_avatar(avatar_url: Optional[str]) -> bool:
    """Проверить, что аватар загружен в локальное хранилище."""
    if not avatar_url:
        return False
    normalized = avatar_url.strip().lower()
    return normalized.startswith("/api/avatars/") or normalized.startswith("uploads/avatars/")


router = APIRouter(prefix="/auth", tags=["authentication"])

google_request_adapter = google_requests.Request()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_session)):
    """Регистрация нового пользователя"""
    try:
        if not hasattr(user_data, 'code') or not user_data.code:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Требуется код подтверждения email"
            )
        
        # Проверяем код верификации
        if user_data.code:
            from services.verification_code_service import verification_code_service
            from sqlmodel import select
            from models.verification_code import VerificationCode
            
            # Проверяем, что код существует и валиден
            # Используем существующую сессию db вместо создания новой
            from datetime import datetime
            statement = select(VerificationCode).where(
                VerificationCode.email == user_data.email,
                VerificationCode.code == user_data.code,
                VerificationCode.is_used == False,
                VerificationCode.expires_at > datetime.utcnow()
            )
            
            verification_code = db.exec(statement).first()
            
            if not verification_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный или просроченный код подтверждения"
                )
            
            # Помечаем код как использованный
            verification_code.is_used = True
            verification_code.used_at = datetime.utcnow()
            db.add(verification_code)
            db.commit()
        
        user = create_user(db, user_data)
        return create_user_response(user)
    except HTTPException:
        # Пробрасываем HTTPException как есть (уже содержит правильный статус и сообщение)
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}", exc_info=True)
        # Не раскрываем детали ошибки для безопасности
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось зарегистрировать пользователя. Проверьте введенные данные."
        )


@router.post("/login", response_model=Token)
def login_user(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_session),
):
    """Вход пользователя по email (OAuth2 форма) с защитой от brute-force."""
    # OAuth2PasswordRequestForm использует поле username, но мы используем его для email
    email = form_data.username
    client_ip = request.client.host if request.client else "unknown"

    # Сначала проверяем, не заблокирован ли email или IP
    email_blocked, email_retry = auth_protection_service.is_blocked(email)
    ip_blocked, ip_retry = auth_protection_service.is_blocked(client_ip)

    if email_blocked or ip_blocked:
        retry_after = max(email_retry, ip_retry)
        try:
            from core.security_logger import log_suspicious_activity
            log_suspicious_activity(
                "LOGIN_BLOCKED",
                user_id=None,
                ip_address=client_ip,
                details={"email": email, "retry_after_sec": retry_after},
            )
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Слишком много неудачных попыток входа. Попробуйте снова через {retry_after} секунд.",
            headers={"Retry-After": str(retry_after)},
        )

    user = authenticate_user(db, email, form_data.password)
    if not user:
        try:
            from core.security_logger import log_suspicious_activity
            log_suspicious_activity(
                "LOGIN_FAILED",
                user_id=None,
                ip_address=client_ip,
                details={"email": email},
            )
        except Exception:
            pass
        # Записываем неудачную попытку и для email, и для IP
        email_blocked_now, email_retry_now = auth_protection_service.record_failed_attempt(email)
        ip_blocked_now, ip_retry_now = auth_protection_service.record_failed_attempt(client_ip)

        if email_blocked_now or ip_blocked_now:
            retry_after = max(email_retry_now, ip_retry_now)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Слишком много неудачных попыток входа. Попробуйте снова через {retry_after} секунд.",
                headers={"Retry-After": str(retry_after)},
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Успешный вход — очищаем счётчики для email и IP
    auth_protection_service.clear_attempts(email)
    auth_protection_service.clear_attempts(client_ip)
    # Обновляем время последнего входа
    update_user_last_login(db, user)
    
    # Убеждаемся, что у пользователя есть системные папки
    try:
        from services.folder_service import FolderService
        folder_service = FolderService()
        folder_service.ensure_system_folders_exist(user.id)
    except Exception as e:
        # Логируем ошибку, но не прерываем логин
        logger.error(f"Error ensuring system folders for user {user.id}: {e}", exc_info=True)
    
    # Создаем токен
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires,
    )

    # Сохраняем access_token в HttpOnly cookie для защиты от XSS
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # Для локальной разработки; в production лучше True (через HTTPS)
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=create_user_response(user)
    )


@router.post("/google", response_model=Token)
def login_with_google(
    payload: GoogleAuthRequest,
    response: Response,
    db: Session = Depends(get_session),
):
    """Вход или регистрация пользователя через Google ID Token"""
    logger.info(f"Google login attempt. Allowed clients: {GOOGLE_ALLOWED_CLIENT_IDS}")
    logger.info(f"Request client_id: {payload.client_id}, GOOGLE_CLIENT_ID: {GOOGLE_CLIENT_ID}")
    
    if not GOOGLE_ALLOWED_CLIENT_IDS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured"
        )

    audience = payload.client_id or GOOGLE_CLIENT_ID or GOOGLE_ALLOWED_CLIENT_IDS[0]
    logger.info(f"Using audience for verification: {audience}")
    if not audience:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured"
        )

    try:
        logger.info(f"Verifying Google token with audience: {audience}")
        logger.debug(f"Token preview: {payload.credential[:50] if payload.credential else 'None'}...")
        # Разрешаем расхождение времени до 60 секунд (для компенсации clock skew)
        id_info = id_token.verify_oauth2_token(
            payload.credential,
            google_request_adapter,
            audience=audience,
            clock_skew_in_seconds=60
        )
        logger.info(f"Token verified successfully. Audience in token: {id_info.get('aud')}")
    except ValueError as exc:
        logger.error(f"Invalid Google token: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google token: {str(exc)}"
        )

    aud = id_info.get("aud")
    logger.info(f"Token audience: {aud}, Allowed clients: {GOOGLE_ALLOWED_CLIENT_IDS}")
    if GOOGLE_ALLOWED_CLIENT_IDS and aud not in GOOGLE_ALLOWED_CLIENT_IDS:
        logger.error(f"Token audience {aud} not in allowed list: {GOOGLE_ALLOWED_CLIENT_IDS}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google client {aud} is not allowed. Allowed: {GOOGLE_ALLOWED_CLIENT_IDS}"
        )

    google_sub = id_info.get("sub")
    email = id_info.get("email")
    email_verified = id_info.get("email_verified", False)
    full_name = id_info.get("name")
    # Фото профиля: стандартный ключ в Google ID token — "picture"
    avatar_url = (
        id_info.get("picture")
        or id_info.get("image")
        or id_info.get("avatar")
    )
    if isinstance(avatar_url, str):
        avatar_url = avatar_url.strip() or None

    logger.info(f"Google user data: email={email}, full_name={full_name}, avatar_url={avatar_url}")

    if not google_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google response does not include user id"
        )

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google response does not include email"
        )

    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google email is not verified"
        )

    user = db.exec(select(User).where(User.google_id == google_sub)).first()
    if not user:
        user = get_user_by_email(db, email)

    if user:
        updated = False
        if getattr(user, "google_id", None) != google_sub:
            user.google_id = google_sub
            updated = True
        if getattr(user, "auth_provider", "local") != "google":
            user.auth_provider = "google"
            updated = True
        # Обновляем аватар из Google только если пользователь не загрузил свой локально
        has_local_avatar = _is_local_avatar(getattr(user, "avatar_url", None))
        if avatar_url and not has_local_avatar:
            if user.avatar_url != avatar_url:
                logger.info(
                    "Updating avatar_url from '%s' to '%s' (no local avatar detected)",
                    user.avatar_url,
                    avatar_url,
                )
                user.avatar_url = avatar_url
                updated = True
            else:
                logger.info("Avatar URL unchanged: '%s'", avatar_url)
        elif has_local_avatar:
            logger.info(
                "Skipping avatar update for user %s: local avatar detected (%s)",
                user.id,
                user.avatar_url,
            )
        if full_name and not user.full_name:
            user.full_name = full_name
            updated = True
        if not user.email_verified and email_verified:
            user.email_verified = True
            updated = True

        if updated:
            user.updated_at = datetime.utcnow()
            db.add(user)
            db.commit()
            db.refresh(user)
    else:
        # Создаем нового пользователя через Google
        random_password = token_urlsafe(16)
        user_create = UserCreate(
            email=email,
            password=random_password,
            full_name=full_name,
            avatar_url=avatar_url,
        )
        user = create_user(db, user_create)
        user.google_id = google_sub
        user.email_verified = True
        user.auth_provider = "google"
        # Всегда подтягиваем фото из Google при регистрации
        if avatar_url:
            user.avatar_url = avatar_url
            logger.info(f"Setting avatar_url for new Google user: '{avatar_url}'")
        user.updated_at = datetime.utcnow()
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created/updated user: id={user.id}, email={user.email}, avatar_url={user.avatar_url}")

    # Обновляем время последнего входа
    update_user_last_login(db, user)

    # Убеждаемся, что у пользователя есть системные папки
    try:
        from services.folder_service import FolderService
        folder_service = FolderService()
        folder_service.ensure_system_folders_exist(user.id)
    except Exception as e:
        logger.error(f"Error ensuring system folders for user {user.id}: {e}", exc_info=True)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires,
    )

    # Сохраняем access_token в HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,  # В production установить True
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    user_response = create_user_response(user)
    logger.info(f"Returning user response: id={user_response.id}, email={user_response.email}, avatar_url={user_response.avatar_url}")
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user_response
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Получение информации о текущем пользователе"""
    try:
        # Инициализация messages_cycle_started_at для legacy-пользователей
        if getattr(current_user, "messages_cycle_started_at", None) is None:
            base = current_user.created_at or datetime.utcnow()
            current_user.messages_cycle_started_at = base.replace(hour=0, minute=0, second=0, microsecond=0)
            db.add(current_user)
            db.commit()
        
        # Проверяем статус подписки (передаем сессию для сброса цикла)
        SubscriptionService.check_subscription_status(current_user, db)
        
        db.refresh(current_user)
    except Exception as e:
        logger.error(f"Error in get_current_user_info for user {current_user.id}: {e}", exc_info=True)
        db.refresh(current_user)
    
    return create_user_response(current_user)


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Обновление информации о текущем пользователе"""
    # Обновляем только переданные поля
    if user_update.email is not None:
        existing_user = get_user_by_email(db, user_update.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует"
            )
        current_user.email = user_update.email
    
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url
    
    if user_update.password is not None:
        # Валидация нового пароля
        from core.security import validate_password_strength
        is_valid, error_message = validate_password_strength(user_update.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message or "Пароль не соответствует требованиям безопасности"
            )
        current_user.hashed_password = get_password_hash(user_update.password)
    
    if user_update.username is not None:
        # Проверяем, что username не занят другим пользователем
        from sqlmodel import select
        statement = select(User).where(
            User.username == user_update.username,
            User.id != current_user.id
        )
        existing_user = db.exec(statement).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким username уже существует"
            )
        current_user.username = user_update.username

    # Исправлено: используем текущее время, а не created_at
    current_user.updated_at = datetime.utcnow()
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return create_user_response(current_user)


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Загрузка аватара пользователя"""
    # Проверяем тип файла
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл должен быть изображением"
        )
    
    # Проверяем размер файла (максимум 5MB)
    file_content = await file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Размер файла не должен превышать 5MB"
        )
    
    try:
        # Проверяем, что это действительно изображение
        image = Image.open(io.BytesIO(file_content))
        # Конвертируем в RGB если нужно (для PNG с прозрачностью)
        if image.mode in ("RGBA", "LA", "P"):
            rgb_image = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            rgb_image.paste(image, mask=image.split()[-1] if image.mode in ("RGBA", "LA") else None)
            image = rgb_image
        
        # Изменяем размер до максимум 512x512, сохраняя пропорции
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        # Создаем директорию для аватаров
        # Путь относительно корня проекта (где запускается main.py)
        avatars_dir = Path("uploads/avatars")
        avatars_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем уникальное имя файла
        file_ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
        filename = f"{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
        filepath = avatars_dir / filename
        
        # Сохраняем изображение
        image.save(filepath, "JPEG", quality=85, optimize=True)
        
        # Удаляем старый аватар, если он был локальным файлом
        if current_user.avatar_url and current_user.avatar_url.startswith("/api/avatars/"):
            old_filename = current_user.avatar_url.split("/")[-1]
            old_filepath = avatars_dir / old_filename
            if old_filepath.exists() and old_filepath.is_file():
                try:
                    old_filepath.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete old avatar: {e}")
        
        # Обновляем avatar_url в базе данных
        avatar_url = f"/api/avatars/{filename}"
        current_user.avatar_url = avatar_url
        current_user.updated_at = datetime.utcnow()
        
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"Avatar uploaded for user {current_user.id}: {avatar_url}")
        
        return create_user_response(current_user)
        
    except Exception as e:
        logger.error(f"Error uploading avatar: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке аватара: {str(e)}"
        )


@router.post("/logout")
def logout_user(response: Response):
    """Выход пользователя: очищаем access_token cookie (и клиенту не нужно трогать токен)."""
    response.delete_cookie("access_token")
    return {"message": "Успешный выход из системы"}


@router.get("/verify-token")
def verify_user_token(current_user: User = Depends(get_current_active_user)):
    """Проверка валидности токена"""
    try:
        # Инициализация messages_cycle_started_at для legacy-пользователей
        if getattr(current_user, "messages_cycle_started_at", None) is None:
            base = current_user.created_at or datetime.utcnow()
            current_user.messages_cycle_started_at = base.replace(hour=0, minute=0, second=0, microsecond=0)
            with get_session() as db:
                db.add(current_user)
                db.commit()
    except Exception as e:
        logger.error(f"Error in verify_user_token for user {current_user.id}: {e}", exc_info=True)
    
    return {
        "valid": True,
        "user": create_user_response(current_user)
    }


@router.get("/usage-stats", response_model=UsageStatsResponse)
def get_usage_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Получение статистики использования пользователя"""
    # Для всех тарифов: ежедневный сброс сообщений в 00:00 UTC
    # Считаем сообщения за текущий день
    
    now = datetime.utcnow()
    
    # Для всех тарифов считаем сообщения за текущий день (с 00:00 UTC)
    period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Сообщения за текущий день (все сообщения: пользователя + агентов)
    messages_this_period = db.exec(
        select(func.count(Message.id))
        .join(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Message.created_at >= period_start
        )
    ).first() or 0
    
    # Также учитываем сообщения из групповых чатов
    multi_agent_messages_this_period = db.exec(
        select(func.count(Message.id))
        .join(MultiAgentConversation)
        .where(
            MultiAgentConversation.user_id == current_user.id,
            Message.created_at >= period_start
        )
    ).first() or 0
    
    messages_this_period = messages_this_period + multi_agent_messages_this_period
    
    # Общее количество всех сообщений пользователя за все время (все сообщения: пользователя + агентов)
    messages_total = db.exec(
        select(func.count(Message.id))
        .join(Conversation)
        .where(Conversation.user_id == current_user.id)
    ).first() or 0
    
    # Также учитываем сообщения из групповых чатов за все время
    multi_agent_messages_total = db.exec(
        select(func.count(Message.id))
        .join(MultiAgentConversation)
        .where(MultiAgentConversation.user_id == current_user.id)
    ).first() or 0
    
    messages_total = messages_total + multi_agent_messages_total
    
    # Общее количество всех чатов (исключая чаты с удаленными tools/models агентами)
    # Используем LEFT JOIN для явной проверки существования агента и его категории
    from models.agent import Agent
    
    # Считаем обычные чаты только с персонажами или без агента (системные чаты)
    # Исключаем каналы (is_channel=True) и чаты с удаленными tools/models агентами
    # Используем LEFT JOIN, чтобы явно исключить чаты с несуществующими агентами
    # Исключаем пустые чаты (без сообщений), которые не являются системными
    regular_conversations_count = db.exec(
        select(func.count(func.distinct(Conversation.id)))
        .outerjoin(Agent, Conversation.agent_id == Agent.id)
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.is_channel == False,  # Исключаем каналы  # noqa: E712
            or_(
                # Системные чаты (считаем даже если пустые)
                Conversation.is_system_chat == True,  # noqa: E712
                # Чаты с персонажами (только если есть сообщения)
                and_(
                    Agent.id.isnot(None),  # Агент существует
                    ~Agent.category.ilike("%tools%"),  # Не tools
                    ~Agent.category.ilike("%models%"),  # Не models
                    Message.id.isnot(None)  # Есть хотя бы одно сообщение
                ),
                # Чаты без агента, но с сообщениями (старые чаты с удаленными агентами, но с историей)
                and_(
                    Conversation.agent_id.is_(None),
                    Message.id.isnot(None)  # Есть хотя бы одно сообщение
                )
            )
        )
    ).first() or 0
    
    # Считаем групповые чаты (multi-agent) - они уже фильтруются по user_id
    multi_agent_conversations_count = db.exec(
        select(func.count(MultiAgentConversation.id))
        .where(MultiAgentConversation.user_id == current_user.id)
    ).first() or 0
    
    # Общее количество всех чатов
    conversations_count = regular_conversations_count + multi_agent_conversations_count
    
    # Количество уникальных агентов-персонажей, с которыми пользователь общался
    agents_used = db.exec(
        select(func.count(func.distinct(Conversation.agent_id)))
        .outerjoin(Agent, Conversation.agent_id == Agent.id)
        .outerjoin(Message, Conversation.id == Message.conversation_id)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.agent_id.isnot(None),  # Исключаем беседы без агента
            Agent.id.isnot(None),  # Агент существует
            ~Agent.category.ilike("%tools%"),  # Не tools
            ~Agent.category.ilike("%models%"),  # Не models
            Message.id.isnot(None)  # Есть хотя бы одно сообщение
        )
    ).first() or 0
    
    return UsageStatsResponse(
        messages_this_month=messages_this_period,
        messages_total=messages_total,
        messages_limit=current_user.messages_limit,
        agents_used=agents_used,
        conversations_count=conversations_count
    )


@router.post("/export-chat-data", response_model=ChatExportResponse)
def export_chat_data(
    export_request: ChatExportRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Экспорт данных чата"""
    # Проверяем, что беседа принадлежит пользователю
    conversation = db.exec(
        select(Conversation)
        .where(
            Conversation.id == export_request.conversation_id,
            Conversation.user_id == current_user.id
        )
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Беседа не найдена"
        )
    
    # Получаем сообщения
    messages = db.exec(
        select(Message)
        .where(Message.conversation_id == export_request.conversation_id)
        .order_by(Message.created_at)
    ).all()
    
    # Генерируем файл
    filename = f"chat_export_{conversation.id}_{uuid.uuid4().hex[:8]}.{export_request.format}"
    filepath = os.path.join("exports", filename)
    
    # Создаем директорию если не существует
    os.makedirs("exports", exist_ok=True)
    
    # Записываем данные в файл
    with open(filepath, "w", encoding="utf-8") as f:
        if export_request.format == "txt":
            f.write(f"Экспорт чата: {conversation.title}\n")
            f.write(f"Дата экспорта: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 50 + "\n\n")
            
            for message in messages:
                role = "Пользователь" if message.is_from_user else "Агент"
                f.write(f"[{message.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {role}:\n")
                f.write(f"{message.content}\n\n")
        elif export_request.format == "json":
            data = {
                "conversation": {
                    "id": conversation.id,
                    "title": conversation.title,
                    "created_at": conversation.created_at.isoformat() if conversation.created_at else None
                },
                "messages": [
                    {
                        "id": msg.id,
                        "content": msg.content,
                        "is_from_user": msg.is_from_user,
                        "created_at": msg.created_at.isoformat() if msg.created_at else None
                    }
                    for msg in messages
                ],
                "exported_at": datetime.utcnow().isoformat()
            }
            f.write(json.dumps(data, ensure_ascii=False, indent=2))
    
    # Генерируем временную ссылку для скачивания
    download_url = f"/api/download/{filename}"
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    return ChatExportResponse(
        download_url=download_url,
        expires_at=expires_at
    )


@router.post("/upgrade-to-api", response_model=APIUpgradeResponse)
def upgrade_to_api(
    upgrade_request: APIUpgradeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Обновление до API доступа"""
    result = SubscriptionService.upgrade_subscription(
        db, current_user, "api", upgrade_request.api_key
    )
    
    if result["success"]:
        return APIUpgradeResponse(
            success=True,
            message=result["message"],
            api_access=True
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )


@router.post("/upgrade-subscription-real", response_model=SubscriptionUpgradeResponse)
async def upgrade_subscription_real(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Обновление подписки пользователя"""
    try:
        body = await request.json()
        subscription_tier = body.get("subscription_tier")
        api_key = body.get("api_key")

        if not subscription_tier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="subscription_tier is required"
            )

        if subscription_tier not in ["free", "plus", "pro", "api"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid subscription tier: {subscription_tier}"
            )

        # Используем SubscriptionService вместо дублирования логики
        result = SubscriptionService.upgrade_subscription(
            db, current_user, subscription_tier, api_key
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get("message", "Upgrade failed")
            )

        db.refresh(current_user)
        
        return SubscriptionUpgradeResponse(
            success=True,
            message=result["message"],
            subscription_tier=current_user.subscription_tier,
            messages_limit=current_user.messages_limit,
            expires_at=current_user.expires_at.isoformat() if current_user.expires_at else None,
            price=SubscriptionService.SUBSCRIPTION_CONFIGS.get(
                subscription_tier, {}
            ).get("price", 0)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error upgrading subscription for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении подписки: {str(e)}"
        )


@router.get("/subscription")
def get_subscription_info(
    current_user: User = Depends(get_current_active_user)
):
    """Получение информации о подписке пользователя"""
    tier = getattr(current_user, 'subscription_tier', 'free') or 'free'
    used = getattr(current_user, 'messages_used', 0) or 0
    limit = getattr(current_user, 'messages_limit', 50) or 50
    api = getattr(current_user, 'api_access', False)
    
    expires_at = current_user.expires_at.isoformat() if current_user.expires_at else None
    days_remaining = None
    if current_user.expires_at:
        days_remaining = (current_user.expires_at - datetime.utcnow()).days
        days_remaining = max(0, days_remaining)
    
    return {
        "subscription_tier": tier,
        "is_expired": current_user.expires_at and current_user.expires_at < datetime.utcnow(),
        "expires_at": expires_at,
        "days_remaining": days_remaining,
        "messages_used": used,
        "messages_limit": limit,
        "api_access": bool(api) if api is not None else False,
        "can_upgrade": tier != "pro",
        "can_downgrade": tier != "free"
    }


@router.get("/check-message-limit")
def check_message_limit(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """
    Проверить, может ли пользователь отправить сообщение
    Использует ту же логику, что и при отправке сообщения
    """
    try:
        # Проверяем статус подписки (передаем сессию для сброса цикла)
        SubscriptionService.check_subscription_status(current_user, db)
        
        # Проверяем лимит сообщений
        can_send = SubscriptionService.can_send_message(current_user, db)
        
        # Получаем количество сообщений за сегодня для информации
        messages_today = SubscriptionService.get_all_messages_count_today(db, current_user)
        
        return {
            "can_send": can_send,
            "messages_today": messages_today,
            "messages_limit": current_user.messages_limit,
            "subscription_tier": current_user.subscription_tier,
            "remaining": max(0, current_user.messages_limit - messages_today)
        }
    except Exception as e:
        logger.error(f"Error checking message limit for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при проверке лимита сообщений"
        )




@router.post("/check-email", response_model=CheckEmailResponse)
def check_email_exists(
    request: CheckEmailRequest,
    db: Session = Depends(get_session)
):
    """Проверить, существует ли пользователь с таким email"""
    try:
        user = get_user_by_email(db, request.email)
        
        if user:
            return CheckEmailResponse(
                exists=True,
                message="Email найден"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким email не найден"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking email: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при проверке email"
        )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_session)
):
    """Отправить код для сброса пароля на email"""
    try:
        user = get_user_by_email(db, request.email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким email не найден"
            )
        
        # TODO: Здесь должна быть логика генерации кода и отправки email
        # Пока просто возвращаем успех
        logger.info(f"Password reset requested for user: {user.email}")
        
        return ForgotPasswordResponse(
            success=True,
            message="Код для сброса пароля отправлен на ваш email"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in forgot password: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при отправке кода для сброса пароля"
        )


@router.post("/send-registration-code")
async def send_registration_code(request: SendResetCodeRequest, db: Session = Depends(get_session)):
    """Отправляет код верификации на email для регистрации"""
    try:
        # Проверяем, что пользователя с таким email НЕ существует
        user = get_user_by_email(db, request.email)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже зарегистрирован"
            )

        from services.verification_code_service import verification_code_service
        success = verification_code_service.send_registration_code(request.email)
        if success:
            return {"success": True, "message": "Код отправлен на ваш email"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось отправить код")
    except HTTPException:
        # Пробрасываем HTTPException
        raise
    except Exception as e:
        logger.error(f"Error in send_registration_code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-reset-code")
async def send_reset_code(request: SendResetCodeRequest, db: Session = Depends(get_session)):
    """Отправляет код верификации на email"""
    try:
        # Проверяем, существует ли пользователь с таким email
        user = get_user_by_email(db, request.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь с таким email не найден"
            )

        from services.verification_code_service import verification_code_service
        success = verification_code_service.send_verification_code(request.email)
        if success:
            return {"success": True, "message": "Код отправлен на ваш email"}
        else:
            raise HTTPException(status_code=500, detail="Не удалось отправить код")
    except HTTPException:
        # Пробрасываем HTTPException
        raise
    except Exception as e:
        logger.error(f"Error in send_reset_code: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-reset-code", response_model=VerifyCodeResponse)
async def verify_reset_code(request: VerifyCodeRequest):
    """Проверяет код верификации"""
    try:
        from services.verification_code_service import verification_code_service
        result = verification_code_service.verify_code(request.email, request.code)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    session: Session = Depends(get_session)
):
    """Сбрасывает пароль пользователя"""
    try:
        # Проверяем токен (реализация зависит от вашей системы токенов)
        # verify_token(request.token, request.email)
        
        # Находим пользователя
        statement = select(User).where(User.email == request.email)
        user = session.exec(statement).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        
        # Хэшируем новый пароль
        user.hashed_password = get_password_hash(request.new_password)
        user.reset_token = None
        user.reset_token_expires = None
        
        session.add(user)
        session.commit()
        
        return {"success": True, "message": "Пароль успешно сброшен"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class DeleteAccountRequest(BaseModel):
    """Запрос на удаление аккаунта"""
    password: Optional[str] = None


class DeleteAccountResponse(BaseModel):
    """Ответ при удалении аккаунта"""
    success: bool
    message: str


@router.post("/delete-account", response_model=DeleteAccountResponse)
async def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Удаление аккаунта пользователя со всеми данными"""
    try:
        logger.info(f"Starting account deletion for user id: {current_user.id}")
        
        # Проверяем пароль только для обычных пользователей
        if current_user.auth_provider != "google":
            if not request.password or not verify_password(request.password, current_user.hashed_password):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверный пароль"
                )
        
        logger.info("Password verified successfully")
        
        user_id = current_user.id
        
        # Удаляем все данные пользователя в правильном порядке
        logger.info(f"Deleting user data for user {user_id}")
        
        # 1. Удаляем файлы (сначала, т.к. они ссылаются на другие сущности)
        statement = select(FileAttachment).where(FileAttachment.user_id == user_id)
        files = db.exec(statement).all()
        logger.info(f"Found {len(files)} files to delete")
        for file in files:
            db.delete(file)
        
        # 2. Удаляем сообщения из мульти-агентных чатов
        statement = select(Message).where(Message.multi_agent_conversation_id.isnot(None))
        multi_messages = db.exec(statement).all()
        # Фильтруем только те, что принадлежат пользователю
        user_multi_messages = [msg for msg in multi_messages if hasattr(msg, 'multi_agent_conversation') and msg.multi_agent_conversation and msg.multi_agent_conversation.user_id == user_id]
        logger.info(f"Found {len(user_multi_messages)} multi-agent messages to delete")
        for message in user_multi_messages:
            db.delete(message)
        
        # 2.5. Удаляем все отчеты пользователя (должно быть до удаления разговоров из-за внешнего ключа)
        # statement = select(Report).where(Report.user_id == user_id)
        # reports = db.exec(statement).all()
        # logger.info(f"Found {len(reports)} reports to delete")
        # for report in reports:
        #     db.delete(report)
        
        # 4. Удаляем все разговоры пользователя
        statement = select(Conversation).where(Conversation.user_id == user_id)
        conversations = db.exec(statement).all()
        logger.info(f"Found {len(conversations)} conversations to delete")
        for conversation in conversations:
            db.delete(conversation)
        
        # 5. Удаляем все мульти-агентные разговоры
        statement = select(MultiAgentConversation).where(MultiAgentConversation.user_id == user_id)
        multi_conversations = db.exec(statement).all()
        logger.info(f"Found {len(multi_conversations)} multi-agent conversations to delete")
        for conversation in multi_conversations:
            db.delete(conversation)
        
        # 6. Удаляем пользовательские агенты
        statement = select(Agent).where(Agent.user_id == user_id)
        user_agents = db.exec(statement).all()
        logger.info(f"Found {len(user_agents)} user agents to delete")
        for agent in user_agents:
            db.delete(agent)
        
        # 7. Удаляем посещения достопримечательностей
        statement = select(AttractionVisit).where(AttractionVisit.user_id == user_id)
        visits = db.exec(statement).all()
        logger.info(f"Found {len(visits)} attraction visits to delete")
        for visit in visits:
            db.delete(visit)
        
        # 8. Удаляем подписки на каналы
        statement = select(UserChannelSubscription).where(UserChannelSubscription.user_id == user_id)
        subscriptions = db.exec(statement).all()
        logger.info(f"Found {len(subscriptions)} channel subscriptions to delete")
        for subscription in subscriptions:
            db.delete(subscription)
        
        # 9. Удаляем папки
        statement = select(Folder).where(Folder.user_id == user_id)
        folders = db.exec(statement).all()
        logger.info(f"Found {len(folders)} folders to delete")
        for folder in folders:
            db.delete(folder)
        
        # Удаляем пользователя
        logger.info(f"Deleting user {user_id}")
        db.delete(current_user)
        db.commit()
        logger.info(f"Account deletion completed for user {user_id}")
        
        logger.info(f"User account deleted: id={user_id}")
        
        return DeleteAccountResponse(
            success=True,
            message="Аккаунт успешно удален"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Не удалось удалить аккаунт")


class LogoutAllDevicesResponse(BaseModel):
    """Ответ при выходе со всех устройств"""
    success: bool
    message: str


@router.post("/logout-all", response_model=LogoutAllDevicesResponse)
async def logout_all_devices(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Выход со всех устройств путем обновления секрета для токенов"""
    try:
        # Генерируем новый токен-секрет для пользователя
        # Это инвалидирует все существующие токены
        current_user.token_secret = token_urlsafe(32)
        current_user.updated_at = datetime.utcnow()
        
        db.add(current_user)
        db.commit()
        
        logger.info(f"User logged out from all devices: id={current_user.id}")
        
        return LogoutAllDevicesResponse(
            success=True,
            message="Вы вышли со всех устройств"
        )
        
    except Exception as e:
        logger.error(f"Error logging out from all devices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Не удалось выполнить выход со всех устройств")
