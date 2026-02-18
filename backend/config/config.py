import os
import logging
from dotenv import load_dotenv

# Загружаем переменные окружения из backend/.env (если есть)
load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# БАЗОВЫЕ НАСТРОЙКИ ПРИЛОЖЕНИЯ
# ---------------------------------------------------------------------------

# Режим окружения: development / production
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# Настройки приложения
SECRET_KEY = os.getenv("SECRET_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # 1 час по умолчанию

# Жёсткая проверка SECRET_KEY: в production без него запускать приложение нельзя
if not SECRET_KEY:
    raise ValueError(
        "SECRET_KEY не установлен в переменных окружения.\n"
        "Сгенерируйте его, например:\n"
        "  python -c 'import secrets; print(secrets.token_urlsafe(64))'\n"
        "и добавьте в backend/.env строку:\n"
        "  SECRET_KEY=<сгенерированное_значение>"
    )

if len(SECRET_KEY) < 32:
    raise ValueError(
        f"SECRET_KEY слишком короткий ({len(SECRET_KEY)} символов). "
        "Рекомендуется минимум 32 символа (64+ для production)."
    )

# Настройки базы данных - PostgreSQL обязателен
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL не установлена в переменных окружения!\n"
        "Установите DATABASE_URL в backend/.env или переменных окружения:\n"
        "  DATABASE_URL=postgresql://user:password@localhost:5432/timetalk"
    )

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_ADDITIONAL_CLIENT_IDS = os.getenv("GOOGLE_ADDITIONAL_CLIENT_IDS", "")
GOOGLE_ALLOWED_CLIENT_IDS = [
    client_id.strip()
    for client_id in [GOOGLE_CLIENT_ID, *GOOGLE_ADDITIONAL_CLIENT_IDS.split(",")]
    if client_id and client_id.strip()
]

# Настройки OpenRouter API
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "dummy-key")

# Верификация email при регистрации
EMAIL_VERIFICATION_REQUIRED = os.getenv("EMAIL_VERIFICATION_REQUIRED", "true").lower() == "true"

# Кука access_token: для cross-origin (фронт на другом домене) нужны SameSite=None и Secure=True.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", str(ENVIRONMENT == "production").lower()).lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "none" if ENVIRONMENT == "production" else "lax").lower()

# ---------------------------------------------------------------------------
# CORS НАСТРОЙКИ
# ---------------------------------------------------------------------------

if ENVIRONMENT == "production":
    # В production по умолчанию никаких доменов не разрешаем — только явно заданные
    raw_origins = os.getenv("ALLOWED_ORIGINS", "")
    ALLOWED_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

    if not ALLOWED_ORIGINS:
        raise ValueError(
            "ALLOWED_ORIGINS должна быть установлена в production.\n"
            "Пример:\n"
            "  ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com"
        )

    # Защита от случайного попадания localhost в production
    for origin in ALLOWED_ORIGINS:
        if "localhost" in origin or "127.0.0.1" in origin:
            raise ValueError(
                f"Недопустимый origin в ALLOWED_ORIGINS для production: {origin}"
            )
else:
    # В development разрешаем localhost по умолчанию
    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    ).split(",")

# ---------------------------------------------------------------------------
# ПРОЧИЕ НАСТРОЙКИ
# ---------------------------------------------------------------------------

# RSS источники для новостных каналов
NYT_RSS_URL = os.getenv(
    "NYT_RSS_URL",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
)
RIA_RSS_URL = os.getenv(
    "RIA_RSS_URL",
    "https://ria.ru/export/rss2/archive/index.xml"
)

# ---------------------------------------------------------------------------
# BEPAID (платежи и подписки)
# ---------------------------------------------------------------------------
BEPAID_SHOP_ID = os.getenv("BEPAID_SHOP_ID", "")
BEPAID_SECRET_KEY = os.getenv("BEPAID_SECRET_KEY", "")
BEPAID_API_URL = os.getenv("BEPAID_API_URL", "https://api.bepaid.by").rstrip("/")
# ID планов подписки в BePaid (создаются в личном кабинете BePaid)
BEPAID_PLAN_PLUS_ID = os.getenv("BEPAID_PLAN_PLUS_ID", "")
BEPAID_PLAN_PRO_ID = os.getenv("BEPAID_PLAN_PRO_ID", "")
# Базовый URL бэкенда для notification_url (куда BePaid шлёт webhook), например https://api.yourapp.com
BEPAID_BACKEND_BASE = os.getenv("BEPAID_BACKEND_BASE", "http://localhost:8000")
# Включить интеграцию с BePaid (если False, кнопки оплаты не ведут в BePaid)
BEPAID_ENABLED = bool(BEPAID_SHOP_ID and BEPAID_SECRET_KEY and BEPAID_PLAN_PLUS_ID and BEPAID_PLAN_PRO_ID)

# Настройки разработки
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
PORT = int(os.getenv("PORT", "8000"))
