from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import os
import sys
import asyncio
from pathlib import Path
import logging
from dotenv import load_dotenv

# Загружаем переменные окружения из .env ДО импорта core.database
# Порядок: backend/.env → корень проекта .env → текущая директория (для Docker переменные уже в окружении)
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
root_env = backend_dir.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

from core.database import create_db_and_tables
from core.security import SecurityHeadersMiddleware, check_secret_key, validate_path_traversal
from core.rate_limiter import RateLimitMiddleware
from core.csrf import CSRFMiddleware
from api.agents import create_agent_endpoints
from api.chat import create_chat_endpoints
from api.multi_agent_chat import create_multi_agent_chat_endpoints
from api.folders import create_folder_endpoints
from api.pinned_chats import create_pinned_chats_endpoints
# from api.pinned_messages import create_pinned_messages_endpoints  # Файл не существует
from api.search import router as search_router
from api.auth import router as auth_router
from api.attractions import create_attractions_endpoints
from api.attraction_visits import create_attraction_visit_endpoints
from api.reports import create_reports_endpoints
from api.support import create_support_endpoints
from api.static_files import router as static_files_router
from api.file_attachments import router as file_attachments_router
from api.payments import router as payments_router
from services.agent_service import AgentService
from services.user_agent_service import UserAgentService
from services.attraction_visit_service import AttractionVisitService
from services.conversation_service import ConversationService
from services.multi_agent_chat_service import MultiAgentChatService
from services.folder_service import FolderService
from services.pinned_chats_service import PinnedChatsService
from config import ALLOWED_ORIGINS, ENVIRONMENT
from core.monitoring import init_sentry
from core.logging_config import setup_sensitive_data_filter

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
setup_sensitive_data_filter()
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
# from services.pinned_chats_service import PinnedChatsService  # Файл не существует
# from services.pinned_messages_service import PinnedMessagesService  # Файл не существует


# Инициализируем мониторинг (если указан SENTRY_DSN)
init_sentry()

# Создаем экземпляры сервисов
agent_service = AgentService()
user_agent_service = UserAgentService(agent_service=agent_service)
conversation_service = ConversationService()
multi_agent_chat_service = MultiAgentChatService(agent_service)
folder_service = FolderService()
pinned_chats_service = PinnedChatsService()
attraction_visit_service = AttractionVisitService()
# pinned_messages_service = PinnedMessagesService()  # Файл не существует




def _suppress_connection_reset_errors(loop, context):
    """Suppress harmless ConnectionResetError on Windows.
    
    This is a known issue with Python's asyncio on Windows where the browser
    closing connections triggers WinError 10054 errors that are logged but
    are actually harmless.
    """
    exception = context.get('exception')
    if isinstance(exception, ConnectionResetError):
        # Suppress ConnectionResetError (WinError 10054) - harmless on Windows
        return
    # Call the default exception handler for all other exceptions
    loop.default_exception_handler(context)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
    
    # Suppress ConnectionResetError on Windows (WinError 10054)
    if sys.platform == 'win32':
        loop = asyncio.get_running_loop()
        loop.set_exception_handler(_suppress_connection_reset_errors)
    
    # Проверка SECRET_KEY при старте (только предупреждение)
    try:
        check_secret_key()
    except ValueError as e:
        logger.warning(f"⚠️  Проблема с SECRET_KEY: {e}")
        # Не прерываем запуск, но логируем предупреждение
    
    create_db_and_tables()
    agent_service.initialize_agents()
    
    # Создаем необходимые директории для файлов
    from pathlib import Path
    Path("uploads/avatars").mkdir(parents=True, exist_ok=True)
    Path("uploads/files").mkdir(parents=True, exist_ok=True)
    Path("exports").mkdir(parents=True, exist_ok=True)
    Path("static/user_agents").mkdir(parents=True, exist_ok=True)
    
    
    yield
    
    # Shutdown
    


# Создаем приложение FastAPI
app = FastAPI(
    title="FastAPI Agents",
    description="API для работы с ИИ агентами",
    version="1.0.0",
    lifespan=lifespan
)

# Порядок middleware ВАЖЕН:
# 1. SecurityHeadersMiddleware  -> внутренний слой (добавляет security-заголовки)
# 2. RateLimitMiddleware        -> промежуточный слой (может вернуть 429)
# 3. CSRFMiddleware             -> защита от CSRF для state-changing запросов
# 4. CORSMiddleware             -> внешний слой, чтобы CORS заголовки добавлялись
#    даже к ответам/ошибкам из внутренних middleware (например, 429 от rate limiter).
# 5. HTTPSRedirectMiddleware    -> самый внешний слой (редиректит HTTP -> HTTPS в production)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CSRFMiddleware)

# Настройка CORS для связи с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# В production опционально редиректим HTTP -> HTTPS.
# На текущем сервере используется только HTTP, поэтому редирект выключен,
# чтобы не ломать CORS preflight-запросы (браузер не допускает редирект для OPTIONS).
ENABLE_HTTPS_REDIRECT = os.getenv("ENABLE_HTTPS_REDIRECT", "false").lower() == "true"
if ENVIRONMENT == "production" and ENABLE_HTTPS_REDIRECT:
    app.add_middleware(HTTPSRedirectMiddleware)

# Подключаем эндпоинты
app.include_router(auth_router)
app.include_router(search_router)
create_agent_endpoints(app, agent_service, user_agent_service)
create_chat_endpoints(app, agent_service, conversation_service, folder_service)
create_multi_agent_chat_endpoints(app, multi_agent_chat_service)
create_folder_endpoints(app, folder_service)
create_pinned_chats_endpoints(app, pinned_chats_service)
create_attractions_endpoints(app)
create_attraction_visit_endpoints(app, attraction_visit_service)
create_reports_endpoints(app)
create_support_endpoints(app)
app.include_router(static_files_router)
app.include_router(file_attachments_router)
app.include_router(payments_router)
# create_pinned_messages_endpoints(app, pinned_messages_service)  # Файл не существует


@app.get("/test-search-db")
async def test_search_db():
    """Тестовый эндпоинт для проверки поиска в базе данных"""
    try:
        from services.search_service import SearchService
        from core.database import engine
        from sqlmodel import Session, select
        from models.user import User
        
        search_service = SearchService()
        
        # Получаем тестового пользователя (первого попавшегося)
        with Session(engine) as session:
            user = session.exec(select(User)).first()
            if not user:
                return {"status": "error", "message": "No users found in database"}
            
            # Пробуем выполнить поиск
            try:
                result = search_service.search_messages(
                    query="test",
                    user_id=user.id,
                    session=session,
                    limit=10
                )
                return {
                    "status": "success", 
                    "message": "Search completed successfully",
                    "user_id": user.id,
                    "results_count": result["total"],
                    "results": result
                }
            except Exception as search_error:
                logger.error(f"Error during search: {search_error}", exc_info=True)
                return {
                    "status": "error", 
                    "message": f"Search failed: {str(search_error)}",
                    "user_id": user.id
                }
    except Exception as e:
        logger.error(f"Error in test_search_db: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@app.get("/test-search")
async def test_search():
    """Тестовый эндпоинт для проверки поиска"""
    try:
        from services.search_service import SearchService
        search_service = SearchService()
        return {"status": "success", "message": "SearchService initialized successfully"}
    except Exception as e:
        logger.error(f"Error initializing SearchService: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@app.get("/")
def read_root():
    """Главная страница веб-интерфейса"""
    return {"message": "Epochal Dialog Backend API", "docs": "/docs"}


@app.get("/health")
def health():
    """Эндпоинт для проверки живости сервиса (мониторинг, load balancer)."""
    return {"status": "ok"}


@app.get("/api")
def read_api_info():
    """Информация об API"""
    return {
        "message": "Добро пожаловать в FastAPI Agents API!",
        "docs": "/docs",
        "agents": "/agents",
        "chat": "/chat",
        "multi_agent_chat": "/multi-agent-chat"
    }


@app.get("/test-api")
async def test_api_connection():  # ✅ Сделал async для await
    """Тестировать подключение к OpenRouter API через LangChain"""
    try:
        is_connected = await agent_service.test_connection()  # ✅ Используем инкапсулированный метод
        return {
            "status": "success" if is_connected else "failed",
            "message": "Подключение к OpenRouter API через LangChain успешно" if is_connected else "Ошибка подключения к OpenRouter API через LangChain"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Ошибка: {str(e)}"
        }


# Глобальный обработчик ошибок валидации
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации — в production не логируем тело запроса (могут быть пароли и т.д.)."""
    if ENVIRONMENT == "production":
        logger.warning("Validation error on %s: %s field(s)", request.url.path, len(exc.errors()))
    else:
        logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Ошибка валидации данных. Проверьте введенные данные."}
    )


# Глобальный обработчик необработанных исключений
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Обработчик необработанных исключений — детали не отдаём клиенту; в production пишем в security.log."""
    client_ip = request.client.host if request.client else "unknown"
    if ENVIRONMENT == "production":
        logger.error("Unhandled exception on %s", request.url.path, exc_info=True)
        try:
            from core.security_logger import log_suspicious_activity
            log_suspicious_activity(
                "INTERNAL_ERROR",
                user_id=None,
                ip_address=client_ip,
                details={"path": request.url.path, "method": request.method},
            )
        except Exception:
            pass
    else:
        logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Внутренняя ошибка сервера. Попробуйте позже."}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
