from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import os
from pathlib import Path
from sqlmodel import Session, select
from urllib.parse import unquote
import logging
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла ДО импорта core.database
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)
    logging.info(f"Загружены переменные окружения из {env_path}")
else:
    # Пробуем загрузить из текущей директории
    load_dotenv()

from core.database import create_db_and_tables, get_session
from core.dependencies import get_current_user
from core.security import SecurityHeadersMiddleware, check_secret_key, sanitize_filename, validate_path_traversal
from core.rate_limiter import RateLimitMiddleware
from api.agents import create_agent_endpoints
from api.chat import create_chat_endpoints
from api.multi_agent_chat import create_multi_agent_chat_endpoints
from api.folders import create_folder_endpoints
from api.saved_messages import create_saved_messages_endpoints
from api.pinned_chats import create_pinned_chats_endpoints
# from api.pinned_messages import create_pinned_messages_endpoints  # Файл не существует
from api.search import router as search_router
from api.auth import router as auth_router
from api.budgets import create_budget_endpoints
from api.savings_goals import create_savings_goal_endpoints
from api.recurring_payments import create_recurring_payment_endpoints
from api.attractions import create_attractions_endpoints
from api.trips import create_trip_endpoints
from api.attraction_visits import create_attraction_visit_endpoints
from api.geocoding import create_geocoding_endpoints
from api.wikipedia_attractions import create_wikipedia_attractions_endpoints
from services.agent_service import AgentService
from services.user_agent_service import UserAgentService
from services.budget_service import BudgetService
from services.savings_goal_service import SavingsGoalService
from services.recurring_payment_service import RecurringPaymentService
from services.trip_service import TripService
from services.attraction_visit_service import AttractionVisitService
from services.geocoding_service import GeocodingService
from services.wikipedia_service import WikipediaService
from services.conversation_service import ConversationService
from services.multi_agent_chat_service import MultiAgentChatService
from services.folder_service import FolderService
from services.pinned_chats_service import PinnedChatsService
from models.file_attachment import FileAttachment
from models.user import User

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
# from services.pinned_chats_service import PinnedChatsService  # Файл не существует
# from services.pinned_messages_service import PinnedMessagesService  # Файл не существует
from config import ALLOWED_ORIGINS


# Создаем экземпляры сервисов
agent_service = AgentService()
user_agent_service = UserAgentService(agent_service=agent_service)
conversation_service = ConversationService()
multi_agent_chat_service = MultiAgentChatService(agent_service)
folder_service = FolderService()
pinned_chats_service = PinnedChatsService()
budget_service = BudgetService()
savings_goal_service = SavingsGoalService()
recurring_payment_service = RecurringPaymentService()
trip_service = TripService()
attraction_visit_service = AttractionVisitService()
geocoding_service = GeocodingService()
wikipedia_service = WikipediaService()
# pinned_messages_service = PinnedMessagesService()  # Файл не существует




@asynccontextmanager
async def lifespan(app: FastAPI):
    """Управление жизненным циклом приложения"""
    # Startup
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
# 3. CORSMiddleware             -> внешний слой, чтобы CORS заголовки добавлялись
#    даже к ответам/ошибкам из внутренних middleware (например, 429 от rate limiter).
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)

# Настройка CORS для связи с фронтендом
# В production ограничить origins только доверенными доменами
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],  # Ограничиваем headers
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
)

# Подключаем эндпоинты
app.include_router(auth_router)
app.include_router(search_router)
create_agent_endpoints(app, agent_service, user_agent_service)
create_chat_endpoints(app, agent_service, conversation_service, folder_service)
create_multi_agent_chat_endpoints(app, multi_agent_chat_service)
create_folder_endpoints(app, folder_service)
create_saved_messages_endpoints(app, conversation_service)
create_pinned_chats_endpoints(app, pinned_chats_service)
create_budget_endpoints(app, budget_service)
create_savings_goal_endpoints(app, savings_goal_service)
create_recurring_payment_endpoints(app, recurring_payment_service)
create_attractions_endpoints(app)
create_trip_endpoints(app, trip_service)
create_attraction_visit_endpoints(app, attraction_visit_service)
create_geocoding_endpoints(app, geocoding_service)
create_wikipedia_attractions_endpoints(app, wikipedia_service)
# create_pinned_messages_endpoints(app, pinned_messages_service)  # Файл не существует


@app.get("/")
def read_root():
    """Главная страница веб-интерфейса"""
    return {"message": "AIgram Backend API", "docs": "/docs"}


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


@app.get("/api/download/{filename}")
def download_file(filename: str):
    """Скачивание экспортированных файлов"""
    # Санитизация имени файла
    sanitized_filename = sanitize_filename(filename)
    
    # Защита от path traversal
    base_dir = os.path.abspath("exports")
    filepath = os.path.join(base_dir, sanitized_filename)
    
    # Проверка path traversal
    if not validate_path_traversal(filepath, base_dir):
        logger.warning(f"Path traversal attempt detected: {filename}")
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    return FileResponse(
        path=filepath,
        filename=sanitized_filename,
        media_type='application/octet-stream'
    )


@app.get("/api/avatars/{filename}")
def get_avatar(filename: str):
    """Получение аватара пользователя"""
    # Санитизация имени файла
    sanitized_filename = sanitize_filename(filename)
    
    # Защита от path traversal
    base_dir = os.path.abspath(os.path.join("uploads", "avatars"))
    filepath = os.path.join(base_dir, sanitized_filename)
    
    # Проверка path traversal
    if not validate_path_traversal(filepath, base_dir):
        logger.warning(f"Path traversal attempt detected in avatar: {filename}")
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Аватар не найден")
    
    # Определяем MIME тип по расширению
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "image/jpeg")
    
    return FileResponse(
        path=filepath,
        media_type=media_type
    )


@app.get("/static/user_agents/{filename:path}")
def get_user_agent_avatar(filename: str):
    """Получение аватара пользовательского персонажа"""
    # Санитизация имени файла
    sanitized_filename = sanitize_filename(filename)
    
    # Защита от path traversal
    base_dir = os.path.abspath("static/user_agents")
    filepath = os.path.join(base_dir, sanitized_filename)
    
    # Проверка path traversal
    if not validate_path_traversal(filepath, base_dir):
        logger.warning(f"Path traversal attempt detected in user agent avatar: {filename}")
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Аватар не найден")
    
    # Определяем MIME тип по расширению
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "image/jpeg")
    
    return FileResponse(
        path=filepath,
        media_type=media_type
    )


@app.get("/static/group_chats/{filename:path}")
def get_group_chat_avatar(filename: str):
    """Получение аватара группового чата"""
    # Санитизация имени файла
    sanitized_filename = sanitize_filename(filename)
    
    # Защита от path traversal
    base_dir = os.path.abspath("static/group_chats")
    filepath = os.path.join(base_dir, sanitized_filename)
    
    # Проверка path traversal
    if not validate_path_traversal(filepath, base_dir):
        logger.warning(f"Path traversal attempt detected in group chat avatar: {filename}")
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Аватар не найден")
    
    # Определяем MIME тип по расширению
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "image/jpeg")
    
    return FileResponse(
        path=filepath,
        media_type=media_type
    )


@app.get("/api/files/{filename:path}")
async def download_file_attachment(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session)
):
    """Скачивание файловых вложений из сообщений
    
    Args:
        filename: Имя файла (stored filename, не original_filename) - может быть URL-encoded
        current_user: Текущий авторизованный пользователь
        db: Сессия базы данных
        
    Returns:
        FileResponse с файлом или HTTPException при ошибке
    """
    # Декодируем URL-encoded filename
    try:
        decoded_filename = unquote(filename)
        logger.debug(f"Decoded filename: {decoded_filename} (original: {filename})")
    except Exception as e:
        logger.warning(f"Failed to decode filename {filename}: {e}")
        decoded_filename = filename
    
    # Ищем FileAttachment по filename в базе данных
    statement = select(FileAttachment).where(FileAttachment.filename == decoded_filename)
    file_attachment = db.exec(statement).first()
    
    if not file_attachment:
        logger.warning(f"File not found in database: {decoded_filename}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Проверяем авторизацию: пользователь должен владеть файлом или разговором
    if file_attachment.user_id != current_user.id:
        # Проверяем, владеет ли пользователь разговором
        from models.conversation import Conversation
        conversation = db.get(Conversation, file_attachment.conversation_id)
        if not conversation or conversation.user_id != current_user.id:
            logger.warning(f"Unauthorized file access attempt: user {current_user.id} tried to access file {file_attachment.filename} (owned by user {file_attachment.user_id})")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Проверяем статус сканирования на вирусы
    if file_attachment.virus_scan_status == "infected":
        logger.warning(f"Attempted to download infected file: {file_attachment.filename}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="File rejected: Virus detected in uploaded file"
        )
    
    # Проверяем существование файла на файловой системе
    # Нормализуем путь для Windows (исправляем разделители)
    file_path = os.path.normpath(file_attachment.file_path)
    
    # Защита от path traversal - проверяем, что файл находится в разрешенной директории
    base_upload_dir = os.path.abspath("backend/uploads")
    if not validate_path_traversal(file_path, base_upload_dir):
        logger.warning(
            f"Path traversal attempt detected: user {current_user.id} tried to access "
            f"file outside uploads directory: {file_path}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if not os.path.exists(file_path):
        logger.error(f"File not found on filesystem: {file_path} (original: {file_attachment.file_path})")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on filesystem"
        )
    
    # Определяем Content-Disposition: inline для изображений, attachment для остальных
    is_image = file_attachment.file_type and file_attachment.file_type.startswith("image/")
    disposition = "inline" if is_image else "attachment"
    
    # Правильно кодируем original_filename для Content-Disposition header (RFC 5987)
    # Используем UTF-8 encoding для кириллицы
    original_filename = file_attachment.original_filename
    try:
        # Проверяем, есть ли не-ASCII символы в имени файла
        import urllib.parse
        has_non_ascii = any(ord(c) > 127 for c in original_filename)
        
        if has_non_ascii:
            # Если есть не-ASCII символы, используем только RFC 5987 формат
            # Это безопасно для latin-1 кодирования заголовков
            encoded_filename = urllib.parse.quote(original_filename, safe='')
            # Используем только filename* без обычного filename (чтобы избежать latin-1 ошибки)
            content_disposition = f'{disposition}; filename*=UTF-8\'\'{encoded_filename}'
        else:
            # Если только ASCII, используем обычный формат
            content_disposition = f'{disposition}; filename="{original_filename}"'
    except Exception as e:
        logger.warning(f"Failed to encode filename {original_filename}: {e}")
        # Fallback: используем ASCII-safe имя
        try:
            safe_filename = original_filename.encode('ascii', 'ignore').decode('ascii')
            content_disposition = f'{disposition}; filename="{safe_filename}"'
        except:
            content_disposition = f'{disposition}; filename="download"'
    
    # Читаем файл и возвращаем с правильными заголовками
    try:
        # Используем нормализованный путь
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        logger.info(f"Serving file: {file_attachment.filename} (original: {original_filename}) to user {current_user.id}")
        
        return Response(
            content=file_content,
            media_type=file_attachment.file_type or "application/octet-stream",
            headers={
                "Content-Disposition": content_disposition,
                "Content-Length": str(len(file_content)),
            }
        )
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error reading file"
        )


# Глобальный обработчик ошибок валидации
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Обработчик ошибок валидации - не раскрывает детали для безопасности"""
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Ошибка валидации данных. Проверьте введенные данные."}
    )


# Глобальный обработчик необработанных исключений
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Обработчик необработанных исключений - не раскрывает детали для безопасности"""
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Внутренняя ошибка сервера. Попробуйте позже."}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
