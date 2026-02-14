import json
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List, Literal
from datetime import datetime


class UserBase(SQLModel):
    """Базовая модель пользователя"""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    full_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, description="URL аватара пользователя")
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    
    # Поля подписки
    subscription_tier: str = Field(default="free")
    messages_used: int = Field(default=0)
    messages_limit: int = Field(default=50)  # Изменено с 100 на 50 согласно тарифу free
    api_access: bool = Field(default=False)
    api_key: Optional[str] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)
    auth_provider: str = Field(default="local", description="Тип аутентификации (local, google)")


class UserCreate(SQLModel):
    """Модель для создания пользователя"""
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    full_name: Optional[str] = Field(default=None, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)
    username: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=50,
        regex=r'^[a-zA-Z0-9._-]+$',
        description="Желаемый username пользователя (если не указан, генерируется автоматически)"
    )
    avatar_url: Optional[str] = Field(default=None, description="URL аватара пользователя")
    code: Optional[str] = Field(default=None, min_length=6, max_length=6, description="Код подтверждения email")


class UserUpdate(SQLModel):
    """Модель для обновления пользователя"""
    email: Optional[str] = Field(default=None, regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    full_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, description="URL аватара пользователя")
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)
    username: Optional[str] = Field(default=None, min_length=3, max_length=50, regex=r'^[a-zA-Z0-9._-]+$')



class User(UserBase, table=True):
    """Основная модель пользователя в базе данных"""
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(..., unique=True, index=True, min_length=3, max_length=50)
    email: str = Field(..., unique=True, index=True, regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    full_name: Optional[str] = Field(default=None, max_length=100)
    avatar_url: Optional[str] = Field(default=None, description="URL аватара пользователя")
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    last_login: Optional[datetime] = Field(default=None)
    messages_cycle_started_at: Optional[datetime] = Field(default=None, description="Начало текущего ежедневного цикла сообщений (UTC). Сброс происходит каждый день в 00:00 UTC.")
    
    # Дополнительные поля для безопасности
    email_verified: bool = Field(default=False)
    verification_token: Optional[str] = Field(default=None)
    reset_token: Optional[str] = Field(default=None)
    reset_token_expires: Optional[datetime] = Field(default=None)
    token_secret: Optional[str] = Field(default=None, description="Секрет для инвалидации токенов при выходе со всех устройств")
    
    # Поля подписки
    subscription_tier: str = Field(default="free")
    messages_used: int = Field(default=0)
    messages_limit: int = Field(default=50)  # Изменено с 100 на 50 согласно тарифу free
    api_access: bool = Field(default=False)
    api_key: Optional[str] = Field(default=None)
    expires_at: Optional[datetime] = Field(default=None)
    # BePaid: привязка к подписке и клиенту в платёжной системе
    bepaid_subscription_id: Optional[str] = Field(default=None)
    bepaid_customer_id: Optional[str] = Field(default=None)
    
    google_id: Optional[str] = Field(
        default=None,
        description="Google subject identifier",
        unique=True,
        index=True,
    )
    pinned_chats: str = Field(default="[]", description="JSON список ID закрепленных чатов")
    

    
    # Связи
    folders: List["Folder"] = Relationship(back_populates="user")
    file_attachments: List["FileAttachment"] = Relationship(back_populates="user")

    def get_pinned_chat_ids(self) -> List[int]:
        """Получить список закрепленных чатов пользователя."""
        try:
            raw_values = json.loads(self.pinned_chats) if self.pinned_chats else []
        except (TypeError, ValueError):
            raw_values = []

        result: List[int] = []
        seen = set()
        for value in raw_values:
            try:
                chat_id = int(value)
            except (TypeError, ValueError):
                continue

            if chat_id not in seen:
                result.append(chat_id)
                seen.add(chat_id)

        return result

    def set_pinned_chat_ids(self, chat_ids: List[int]) -> None:
        """Сохранить список закрепленных чатов пользователя."""
        unique_ids: List[int] = []
        seen = set()

        for value in chat_ids:
            try:
                chat_id = int(value)
            except (TypeError, ValueError):
                continue

            if chat_id not in seen:
                unique_ids.append(chat_id)
                seen.add(chat_id)

        self.pinned_chats = json.dumps(unique_ids)

    def add_pinned_chat(self, chat_id: int) -> bool:
        """Закрепить чат. Возвращает True, если чат был добавлен."""
        try:
            normalized_id = int(chat_id)
        except (TypeError, ValueError):
            return False

        pinned = self.get_pinned_chat_ids()
        if normalized_id in pinned:
            return False

        pinned.insert(0, normalized_id)
        self.set_pinned_chat_ids(pinned)
        return True

    def remove_pinned_chat(self, chat_id: int) -> bool:
        """Открепить чат. Возвращает True, если чат был удален."""
        try:
            normalized_id = int(chat_id)
        except (TypeError, ValueError):
            return False

        pinned = self.get_pinned_chat_ids()
        if normalized_id not in pinned:
            return False

        pinned = [cid for cid in pinned if cid != normalized_id]
        self.set_pinned_chat_ids(pinned)
        return True

    def is_chat_pinned(self, chat_id: int) -> bool:
        """Проверить, закреплен ли чат."""
        try:
            normalized_id = int(chat_id)
        except (TypeError, ValueError):
            return False

        return normalized_id in self.get_pinned_chat_ids()

    def toggle_pinned_chat(self, chat_id: int) -> bool:
        """Переключить состояние закрепления чата. Возвращает новое состояние."""
        if self.is_chat_pinned(chat_id):
            self.remove_pinned_chat(chat_id)
            return False

        self.add_pinned_chat(chat_id)
        return True


class UserResponse(UserBase):
    """Модель для ответа с данными пользователя"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    email_verified: bool = False
    subscription_tier: str = "free"
    messages_used: int = 0
    messages_limit: int = 50  # Изменено с 100 на 50 согласно тарифу free
    api_access: bool = False
    expires_at: Optional[datetime] = None
    messages_cycle_started_at: Optional[datetime] = None
    pinned_chats: List[int] = []



class Token(SQLModel):
    """Модель для JWT токена"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class TokenData(SQLModel):
    """Модель для данных токена"""
    username: Optional[str] = None
    user_id: Optional[int] = None


class UsageStatsResponse(SQLModel):
    """Модель для статистики использования"""
    messages_this_month: int = 0  # Сообщения за текущий месяц/день (в зависимости от тарифа)
    messages_total: int = 0  # Всего сообщений за все время
    messages_limit: int = 50
    agents_used: int = 0  # Количество уникальных агентов
    conversations_count: int = 0  # Общее количество бесед


class ChatExportRequest(SQLModel):
    """Модель для запроса экспорта чата"""
    conversation_id: int
    format: str = Field(default="txt", regex=r'^(txt|json|csv)$')


class ChatExportResponse(SQLModel):
    """Модель для ответа экспорта чата"""
    download_url: str
    expires_at: datetime


class APIUpgradeRequest(SQLModel):
    """Модель для запроса обновления до API"""
    api_key: str = Field(..., min_length=10, max_length=100)


class APIUpgradeResponse(SQLModel):
    """Модель для ответа обновления до API"""
    success: bool
    message: str
    api_access: bool


class SubscriptionUpgradeRequest(SQLModel):
    """Модель для запроса обновления подписки"""
    subscription_tier: str = Field(..., regex=r'^(free|plus|pro|api)$')
    api_key: Optional[str] = Field(default=None, min_length=10, max_length=100)


class SubscriptionUpgradeResponse(SQLModel):
    """Модель для ответа обновления подписки"""
    success: bool
    message: str
    subscription_tier: str
    messages_limit: int
    expires_at: Optional[str] = None
    price: int


class SubscriptionStatusResponse(SQLModel):
    """Модель для ответа статуса подписки"""
    subscription_tier: str
    is_expired: bool
    expires_at: Optional[str] = None
    days_remaining: Optional[int] = None
    messages_used: int
    messages_limit: int
    api_access: bool
    can_upgrade: bool
    can_downgrade: bool


class CheckEmailRequest(SQLModel):
    """Модель для запроса проверки email"""
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


class CheckEmailResponse(SQLModel):
    """Модель для ответа проверки email"""
    exists: bool
    message: str


class ForgotPasswordRequest(SQLModel):
    """Модель для запроса сброса пароля"""
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


class ForgotPasswordResponse(SQLModel):
    """Модель для ответа на запрос сброса пароля"""
    success: bool
    message: str
