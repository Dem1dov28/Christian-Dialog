from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
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
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from core.dependencies import get_current_active_user
from core.user_utils import create_user_response
from services.subscription_service import SubscriptionService
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
    SubscriptionUpgradeResponse
)
from models.conversation import Conversation
from models.message import Message
from models.multi_agent_conversation import MultiAgentConversation
from pydantic import BaseModel

from config import GOOGLE_ALLOWED_CLIENT_IDS, GOOGLE_CLIENT_ID

logger = logging.getLogger(__name__)

# Модель для обновления настройки системного чата
class SystemChatVisibilityRequest(BaseModel):
    is_hidden: bool


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
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_session)):
    """Вход пользователя по email (OAuth2 форма)"""
    # OAuth2PasswordRequestForm использует поле username, но мы используем его для email
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
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
        expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=create_user_response(user)
    )


@router.post("/google", response_model=Token)
def login_with_google(payload: GoogleAuthRequest, db: Session = Depends(get_session)):
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
    avatar_url = id_info.get("picture")
    
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
        # Убеждаемся, что avatar_url установлен
        if avatar_url and not user.avatar_url:
            logger.info(f"Setting avatar_url for new user: '{avatar_url}'")
            user.avatar_url = avatar_url
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
        expires_delta=access_token_expires
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
    
    if user_update.is_system_chat_hidden is not None:
        current_user.is_system_chat_hidden = user_update.is_system_chat_hidden
    
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
def logout_user():
    """Выход пользователя (на клиенте нужно удалить токен)"""
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


@router.put("/system-chat-visibility", response_model=UserResponse)
def update_system_chat_visibility(
    request: SystemChatVisibilityRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_session)
):
    """Обновить настройку видимости системного чата"""
    try:
        current_user.is_system_chat_hidden = request.is_hidden
        current_user.updated_at = datetime.utcnow()
        
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        
        return create_user_response(current_user)
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating system chat visibility for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось обновить настройку: {str(e)}"
        )
