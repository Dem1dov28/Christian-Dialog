import os
import logging
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

logger = logging.getLogger(__name__)

# Настройки приложения
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production-12345")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # 1 час по умолчанию (было 24 часа)

# Проверка SECRET_KEY при импорте модуля (только предупреждение, не ошибка)
if SECRET_KEY in ["your-super-secret-key-change-in-production-12345", "your-secret-key-change-in-production"]:
    logger.warning(
        "⚠️  SECRET_KEY использует небезопасное значение по умолчанию! "
        "Установите уникальный SECRET_KEY в переменных окружения."
    )
elif len(SECRET_KEY) < 32:
    logger.warning(
        f"⚠️  SECRET_KEY слишком короткий ({len(SECRET_KEY)} символов). "
        "Рекомендуется минимум 32 символа для безопасности."
    )

# Настройки базы данных - PostgreSQL обязателен
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL не установлена в переменных окружения!\n"
        "Установите DATABASE_URL в .env файле или переменных окружения:\n"
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

# Настройки CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,http://localhost:8083,http://127.0.0.1:8083,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082").split(",")

# RSS источники для новостных каналов
NYT_RSS_URL = os.getenv(
    "NYT_RSS_URL",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
)
RIA_RSS_URL = os.getenv(
    "RIA_RSS_URL",
    "https://ria.ru/export/rss2/archive/index.xml"
)

# Настройки разработки
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
PORT = int(os.getenv("PORT", "8000"))
