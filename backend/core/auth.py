from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlmodel import Session, select
from core.database import ensure_user_messages_cycle_column
from models.user import User, TokenData
from models.agent import Agent
from core.security import validate_password_strength, check_secret_key
from config import SECRET_KEY  # Единый источник секретного ключа
# from services.subscription_service import SubscriptionService  # Временно отключено для отладки
import logging

# Настройки для JWT
logger = logging.getLogger(__name__)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 час для access token (было 24 часа - слишком долго)
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 дней для refresh token

# Настройки для хеширования паролей
# Используем bcrypt_sha256, оставляем bcrypt для проверки старых хешей
pwd_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создание JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, credentials_exception):
    """Проверка JWT токена"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if username is None or user_id is None:
            raise credentials_exception
        token_data = TokenData(username=username, user_id=user_id)
        return token_data
    except JWTError:
        raise credentials_exception


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Получение пользователя по имени"""
    ensure_user_messages_cycle_column()
    statement = select(User).where(User.username == username)
    return db.exec(statement).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Получение пользователя по email"""
    ensure_user_messages_cycle_column()
    statement = select(User).where(User.email == email)
    return db.exec(statement).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Получение пользователя по ID"""
    ensure_user_messages_cycle_column()
    return db.get(User, user_id)


def authenticate_user(db: Session, email: str, password: str) -> Union[User, bool]:
    """
    Аутентификация пользователя по email с защитой от timing attacks
    
    Всегда выполняет проверку пароля, даже если пользователь не найден,
    чтобы предотвратить timing attacks (определение существования email)
    """
    user = get_user_by_email(db, email)
    
    # Используем фиктивный хеш для защиты от timing attacks
    # Если пользователь не найден, все равно проверяем пароль с фиктивным хешем
    if not user:
        # Создаем фиктивный хеш для постоянного времени выполнения
        # Используем предварительно вычисленный хеш для избежания лишних вычислений
        dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5Y5Y5Y5Y5"  # Фиктивный bcrypt хеш
        verify_password(password, dummy_hash)
        # Небольшая задержка для выравнивания времени ответа
        import time
        time.sleep(0.01)
        return False
    
    if not verify_password(password, user.hashed_password):
        return False
    
    return user


def _normalize_username(value: str) -> str:
    """Очистить и нормализовать username, введенный пользователем"""
    import re

    username = (value or "").strip().lower()
    username = re.sub(r"[^a-z0-9._-]", "", username)
    return username


def _generate_username_from_email(email: str) -> str:
    """Генерация уникального username из email"""
    import uuid

    base = _normalize_username(email.split("@")[0])
    base = base[:30]

    if not base or len(base) < 3:
        base = f"user{uuid.uuid4().hex[:6]}"

    return base


def create_user(db: Session, user_create) -> User:
    """Создание нового пользователя"""
    ensure_user_messages_cycle_column()
    
    # Валидация пароля
    is_valid, error_message = validate_password_strength(user_create.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message or "Пароль не соответствует требованиям безопасности"
        )
    
    # Проверяем, что пользователь с таким email не существует
    if get_user_by_email(db, user_create.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )

    # Генерируем username из email, если не указан
    username_input = getattr(user_create, "username", None)
    username = _normalize_username(username_input) if username_input else None

    if username_input and not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя может содержать только латинские буквы, цифры, точку, дефис или нижнее подчеркивание",
        )

    if not username:
        username = _generate_username_from_email(user_create.email)

    original_username = username
    suffix = 1
    while get_user_by_username(db, username):
        username = f"{original_username[:25]}{suffix}"
        suffix += 1
        if suffix > 999:
            import uuid
            username = f"user{uuid.uuid4().hex[:6]}"
            suffix = 1

    # Создаем нового пользователя
    hashed_password = get_password_hash(user_create.password)
    db_user = User(
        username=username,
        email=user_create.email,
        full_name=user_create.full_name,
        hashed_password=hashed_password,
        avatar_url=getattr(user_create, "avatar_url", None),
        is_active=True,
        is_admin=False,
        auth_provider=getattr(user_create, "auth_provider", "local"),
    )
    
    # Инициализируем подписку для нового пользователя
    # SubscriptionService.initialize_user_subscription(db_user)  # Временно отключено
    # Простая инициализация подписки
    db_user.subscription_tier = "free"
    db_user.messages_limit = 50
    db_user.api_access = False
    db_user.messages_used = 0
    # Зафиксировать старт цикла сообщений на дату регистрации (00:00 UTC)
    try:
        created = db_user.created_at if getattr(db_user, "created_at", None) else datetime.utcnow()
        db_user.messages_cycle_started_at = created.replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        db_user.messages_cycle_started_at = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Создаем системные папки для нового пользователя
    try:
        from services.folder_service import FolderService
        folder_service = FolderService()
        folder_service.create_system_folders(db_user.id)
        logger.info(f"System folders created for user {db_user.id}")
    except Exception as e:
        # Логируем ошибку, но не прерываем регистрацию
        logger.error(f"Error creating system folders for user {db_user.id}: {e}", exc_info=True)
    
    return db_user


def update_user_last_login(db: Session, user: User):
    """Обновление времени последнего входа"""
    user.last_login = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)