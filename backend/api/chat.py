from typing import Optional, List, Union
from fastapi import Depends, HTTPException, Query, status, File, UploadFile, Form, Request, Body
from sqlmodel import Session, select
from datetime import datetime
from pydantic import BaseModel
import logging
import json
import re

from models.message import ChatMessage, Message
from models.conversation import Conversation, ConversationPublic
from models.multi_agent_conversation import MultiAgentConversation
from models.user import User, UserResponse
from models.file_attachment import FileAttachment
from core.dependencies import get_current_active_user, get_session
from core.validators import validate_message_content, validate_agent_id, validate_pagination_params
from core.user_utils import create_user_response
from services.conversation_service import ConversationService
from services.subscription_service import SubscriptionService
from services.file_storage_service import FileStorageService
from services.file_validation_service import FileValidationService
from services.virus_scan_service import VirusScanService
from services.file_extraction_service import FileExtractionService
from services.test_answer_service import TestAnswerService

logger = logging.getLogger(__name__)

# Модель для обновления настройки системного чата
class SystemChatVisibilityRequest(BaseModel):
    is_hidden: bool

# Модель для сохранения правил пользователя
class UserRulesRequest(BaseModel):
    rules: List[str]

# Модель для обновления выбранной модели чата
class SelectedModelRequest(BaseModel):
    model: str

# Модель для обновления названия чата
class ConversationTitleRequest(BaseModel):
    title: str

# Модель для создания нового чата
class CreateChatRequest(BaseModel):
    agent_id: int

# Модель для сохранения заметки без агента
class SaveNoteRequest(BaseModel):
    conversation_id: int
    message: str

# Модель для проверки ответов теста
class TestAnswerItem(BaseModel):
    question_id: str
    question: str
    answer: str


class CheckTestAnswersRequest(BaseModel):
    agent_id: int
    questions: List[TestAnswerItem]
    conversation_id: Optional[int] = None
    test_id: Optional[str] = None  # Уникальный ID теста из HTML


def create_chat_endpoints(app, agent_service, conversation_service: ConversationService, folder_service=None):
    # Инициализируем сервис для работы с ответами на тесты
    test_answer_service = TestAnswerService()
    """Создать эндпоинты для чата"""
    
    def verify_conversation_access(
        conversation_id: int,
        current_user: User,
        *,
        read_only: bool = False,
    ) -> ConversationPublic:
        """Проверить права доступа к разговору"""
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        if getattr(conversation, "is_channel", False):
            is_owner = (
                conversation.channel_owner_id is not None
                and conversation.channel_owner_id == current_user.id
            )
            if read_only:
                if not conversation.is_listed and not is_owner:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Channel is hidden",
                    )
            else:
                if not is_owner:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied",
                    )
            return conversation

        if conversation.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        return conversation
    
    @app.post("/chat/new")
    async def create_new_chat(request: CreateChatRequest, current_user: User = Depends(get_current_active_user)):
        """Создать новый чат с агентом"""
        try:
            agent_id = validate_agent_id(request.agent_id)
            
            # Проверяем, существует ли агент и активен ли он
            agent = agent_service.get_agent(agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )
            
            if not agent_service.is_agent_active(agent_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Agent is not active"
                )
            
            # Создаем новый разговор (тип agents_only по умолчанию)
            conversation = conversation_service.create_conversation(
                agent_id, 
                f"Чат с {agent.name}", 
                current_user.id, 
                folder_service,
                conversation_type="agents_only"
            )
            
            logger.info(f"Chat created: conversation_id={conversation.id}, user_id={current_user.id}, agent_id={agent_id}")
            
            return {
                "id": conversation.id,
                "conversation_id": conversation.id,
                "title": conversation.title,
                "agent_name": agent.name,
                "agent_id": agent_id,
                "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
                "selected_model": conversation.selected_model  # Возвращаем выбранную модель
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating chat: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating chat"
            )
    
    # Инициализируем сервисы для работы с файлами
    file_storage_service = FileStorageService()
    file_validation_service = FileValidationService()
    virus_scan_service = VirusScanService()
    file_extraction_service = FileExtractionService()
    
    @app.post("/chat/upload-file")
    async def upload_file(
        file: UploadFile = File(...),
        conversation_id: int = Form(...),
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Загрузить файл отдельно (до отправки сообщения)
        
        Args:
            file: Файл для загрузки
            conversation_id: ID разговора
            current_user: Текущий пользователь
            db: Сессия базы данных
            
        Returns:
            FileAttachmentPublic с информацией о загруженном файле
        """
        try:
            # ✅ ВАЖНО: Выполняем миграцию message_id на nullable напрямую, если еще не выполнена
            try:
                from core.database import engine
                with engine.connect() as conn:
                    # Проверяем, нужна ли миграция
                    res = conn.exec_driver_sql("PRAGMA table_info(fileattachment)")
                    columns_info = res.fetchall()
                    message_id_info = next((row for row in columns_info if row[1] == "message_id"), None)
                    
                    if message_id_info and bool(message_id_info[3]):
                        logger.info("Выполняется миграция message_id на nullable...")
                        trans = conn.begin()
                        try:
                            conn.exec_driver_sql("PRAGMA foreign_keys=OFF")
                            conn.exec_driver_sql("""
                                CREATE TABLE fileattachment_new (
                                    id INTEGER PRIMARY KEY,
                                    filename VARCHAR(255) NOT NULL,
                                    original_filename VARCHAR(255) NOT NULL,
                                    file_path VARCHAR(500) NOT NULL,
                                    file_size INTEGER NOT NULL,
                                    file_type VARCHAR(50) NOT NULL,
                                    file_extension VARCHAR(10) NOT NULL,
                                    user_id INTEGER NOT NULL,
                                    conversation_id INTEGER NOT NULL,
                                    message_id INTEGER,
                                    created_at DATETIME NOT NULL,
                                    updated_at DATETIME,
                                    virus_scan_status VARCHAR(20),
                                    virus_scan_date DATETIME,
                                    FOREIGN KEY (user_id) REFERENCES user(id),
                                    FOREIGN KEY (conversation_id) REFERENCES conversation(id),
                                    FOREIGN KEY (message_id) REFERENCES message(id)
                                )
                            """)
                            conn.exec_driver_sql("INSERT INTO fileattachment_new SELECT * FROM fileattachment")
                            conn.exec_driver_sql("DROP TABLE fileattachment")
                            conn.exec_driver_sql("ALTER TABLE fileattachment_new RENAME TO fileattachment")
                            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_fileattachment_filename ON fileattachment(filename)")
                            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_fileattachment_user_id ON fileattachment(user_id)")
                            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_fileattachment_conversation_id ON fileattachment(conversation_id)")
                            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_fileattachment_message_id ON fileattachment(message_id)")
                            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_fileattachment_created_at ON fileattachment(created_at)")
                            conn.exec_driver_sql("PRAGMA foreign_keys=ON")
                            trans.commit()
                            logger.info("✅ Миграция message_id выполнена успешно!")
                        except Exception as e:
                            trans.rollback()
                            try:
                                conn.exec_driver_sql("PRAGMA foreign_keys=ON")
                            except:
                                pass
                            logger.error(f"Ошибка миграции: {e}", exc_info=True)
            except Exception as e:
                logger.warning(f"Не удалось выполнить миграцию: {e}")
            
            # Проверяем доступ к разговору
            conversation = verify_conversation_access(conversation_id, current_user)
            
            # Валидация файла
            files_list = [file]
            is_valid, error, validation_results = file_validation_service.validate_files(files_list)
            if not is_valid:
                logger.warning(f"File validation failed for user {current_user.id}: {error}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error or "File validation failed"
                )
            
            # Сохраняем файл (без message_id, так как сообщения еще нет)
            logger.debug(f"Saving file {file.filename} for user {current_user.id}")
            file_attachment = file_storage_service.save_file(
                db,
                current_user.id,
                conversation_id,
                None,  # message_id будет обновлен при отправке сообщения
                file
            )
            logger.info(f"File saved: {file_attachment.filename} (ID: {file_attachment.id})")
            
            # Сканируем на вирусы
            logger.debug(f"Scanning file {file_attachment.filename} for viruses")
            scan_result = virus_scan_service.scan_file(file_attachment.file_path)
            logger.info(f"Virus scan result for {file_attachment.filename}: {scan_result['status']}")
            
            # Обновляем статус сканирования
            file_attachment.virus_scan_status = scan_result["status"]
            file_attachment.virus_scan_date = scan_result["scan_date"]
            db.commit()
            
            # Если файл заражен, удаляем его и возвращаем ошибку
            if scan_result["status"] == "infected":
                file_storage_service.delete_file(db, file_attachment.id)
                logger.warning(f"Virus detected in file {file.filename} uploaded by user {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="File rejected: Virus detected in uploaded file"
                )
            
            # Если сканирование завершилось с ошибкой, логируем, но продолжаем
            if scan_result["status"] == "error":
                logger.error(
                    f"Virus scan error for file {file_attachment.original_filename}: "
                    f"{scan_result.get('message', 'Unknown error')}. "
                    f"File will be allowed with warning."
                )
            
            # Возвращаем информацию о файле
            return {
                "id": file_attachment.id,
                "filename": file_attachment.filename,
                "original_filename": file_attachment.original_filename,
                "file_size": file_attachment.file_size,
                "file_type": file_attachment.file_type,
                "file_extension": file_attachment.file_extension,
                "created_at": file_attachment.created_at.isoformat() if file_attachment.created_at else None,
                "virus_scan_status": file_attachment.virus_scan_status
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading file: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error uploading file: {str(e)}"
            )
    
    @app.post("/chat/send")
    async def send_message_to_agent(
        request: Request,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Отправить сообщение агенту и получить ответ (с поддержкой файлов)
        
        Поддерживает два формата:
        1. application/json - ChatMessage (для обратной совместимости)
        2. multipart/form-data - Form fields + files (для файлов)
        """
        try:
            # Проверяем статус подписки (передаем сессию для сброса цикла)
            SubscriptionService.check_subscription_status(current_user, db)
            
            # Определяем формат запроса
            content_type = request.headers.get("content-type", "").lower()
            is_multipart = "multipart/form-data" in content_type
            
            # Инициализируем переменные для файлов и attachment_ids
            files = []
            attachment_ids = []
            user_message = None  # Инициализируем переменную для сообщения пользователя
            request_body = None  # Сохраняем тело запроса для повторного использования
            
            # Обрабатываем данные в зависимости от формата
            if is_multipart:
                # Формат multipart/form-data с файлами
                form = await request.form()
                message = form.get("message")
                agent_id_str = form.get("agent_id")
                conversation_id_str = form.get("conversation_id")
                
                if message is None or agent_id_str is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="message and agent_id are required in multipart form"
                    )
                
                try:
                    agent_id = int(agent_id_str)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="agent_id must be an integer"
                    )
                
                conversation_id = int(conversation_id_str) if conversation_id_str else None
                
                message_content = validate_message_content(message)
                agent_id = validate_agent_id(agent_id)
                
                # Получаем файлы из form
                # В multipart форме файлы с одинаковым именем поля доступны через getlist()
                # Проверяем все ключи формы
                for key in form.keys():
                    if key == "files" or key.startswith("files"):
                        # Получаем все файлы с этим ключом
                        file_list = form.getlist(key)
                        for file_item in file_list:
                            # Проверяем, что это действительно файл (UploadFile)
                            if hasattr(file_item, 'filename') and file_item.filename:
                                if file_item not in files:
                                    files.append(file_item)
            else:
                # Формат JSON (обратная совместимость) - парсим вручную
                try:
                    request_body = await request.json()
                    chat_message = ChatMessage(**request_body)
                    message_content = validate_message_content(chat_message.message)
                    agent_id = validate_agent_id(chat_message.agent_id)
                    conversation_id = chat_message.conversation_id
                    # Нет файлов в JSON формате, но могут быть предзагруженные файлы
                    
                    # Проверяем наличие attachment_ids (предзагруженные файлы)
                    attachment_ids = request_body.get("attachment_ids", []) if isinstance(request_body, dict) else []
                except Exception as e:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invalid request format: {str(e)}"
                    )
            
            # Получаем разговор для проверки, является ли он системным
            conversation = None
            if conversation_id:
                conversation = verify_conversation_access(conversation_id, current_user, read_only=True)
                
                # Проверяем тип чата - /chat/send должен работать только с agents_only
                conversation_type = getattr(conversation, "conversation_type", None) or "agents_only"
                if conversation_type != "agents_only":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="This endpoint is for single agent chats only."
                    )
                
                # Проверяем, что пользователь не пытается писать в канал
                if getattr(conversation, "is_channel", False):
                    # В каналах могут писать только владельцы канала (агенты)
                    is_owner = (
                        conversation.channel_owner_id is not None
                        and conversation.channel_owner_id == current_user.id
                    )
                    if not is_owner:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Users cannot write messages in channels. Only channel agents can post messages."
                        )
            
            # Обработка файлов, если они есть
            uploaded_files = []
            extracted_text_parts = []
            
            # Если есть предзагруженные файлы (attachment_ids)
            if not files and attachment_ids:
                try:
                    # Получаем файлы из базы данных по attachment_ids
                    for attachment_id in attachment_ids:
                        file_attachment = db.get(FileAttachment, attachment_id)
                        if not file_attachment:
                            logger.warning(f"File attachment {attachment_id} not found")
                            continue
                        
                        # Проверяем права доступа
                        if file_attachment.user_id != current_user.id:
                            logger.warning(f"User {current_user.id} tried to access file {attachment_id} owned by user {file_attachment.user_id}")
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="Access denied to file attachment"
                            )
                        
                        # Проверяем, что файл принадлежит правильному разговору
                        if file_attachment.conversation_id != conversation_id:
                            logger.warning(f"File attachment {attachment_id} belongs to different conversation")
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="File attachment belongs to different conversation"
                            )
                        
                        uploaded_files.append(file_attachment)
                        logger.info(f"Using pre-uploaded file: {file_attachment.filename} (ID: {file_attachment.id})")
                    
                    # Извлекаем текст из предзагруженных файлов
                    for file_attachment in uploaded_files:
                        try:
                            is_image = file_attachment.file_type and file_attachment.file_type.startswith("image/")
                            
                            if is_image:
                                try:
                                    metadata = file_extraction_service.extract_image_metadata(file_attachment.file_path)
                                    formatted_text = file_extraction_service.format_image_metadata_for_message(
                                        file_attachment.original_filename,
                                        metadata
                                    )
                                    extracted_text_parts.append(formatted_text)
                                except Exception as e:
                                    logger.warning(f"Failed to extract image metadata from {file_attachment.original_filename}: {e}", exc_info=True)
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        "",
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    extracted_text_parts.append(formatted_text)
                            else:
                                extracted_text = file_extraction_service.extract_text(
                                    file_attachment.file_path,
                                    file_attachment.file_type
                                )
                                
                                if extracted_text:
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        extracted_text,
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    extracted_text_parts.append(formatted_text)
                                else:
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        "",
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    extracted_text_parts.append(formatted_text)
                        except Exception as e:
                            logger.warning(f"Failed to process file {file_attachment.original_filename}: {e}", exc_info=True)
                            formatted_text = file_extraction_service.format_extracted_text_for_message(
                                file_attachment.original_filename,
                                "",
                                file_attachment.file_size,
                                file_attachment.file_type
                            )
                            extracted_text_parts.append(formatted_text)
                    
                    # Добавляем извлеченный текст к сообщению
                    if extracted_text_parts:
                        message_with_files = "\n\n".join(extracted_text_parts) + "\n\n---\n\n" + message_content
                    else:
                        message_with_files = message_content
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Error processing pre-uploaded files: {e}", exc_info=True)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Error processing pre-uploaded files: {str(e)}"
                    )
            
            if files:
                # Валидация файлов (проверка размера, типа, количества)
                logger.info(f"Validating {len(files)} file(s) for user {current_user.id}, conversation {conversation_id}")
                is_valid, error, validation_results = file_validation_service.validate_files(files)
                if not is_valid:
                    logger.warning(f"File validation failed for user {current_user.id}: {error}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error or "File validation failed"
                    )
                
                # Создаем conversation если его еще нет
                if not conversation:
                    agent = agent_service.get_agent(agent_id)
                    if not agent:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Agent not found"
                        )
                    conversation = conversation_service.create_conversation(
                        agent_id,
                        f"Чат с {agent.name}",
                        current_user.id,
                        folder_service
                    )
                    conversation_id = conversation.id
                
                # Сохраняем сообщение пользователя сначала (для получения message_id)
                # КРИТИЧНО: Создаем сообщение один раз, чтобы файлы могли к нему привязаться
                user_message = conversation_service.save_message(
                    conversation_id,
                    message_content,
                    is_from_user=True,
                    folder_service=folder_service
                )
                
                # Обрабатываем каждый файл
                try:
                    for file in files:
                        # Сохраняем файл
                        logger.debug(f"Saving file {file.filename} for user {current_user.id}")
                        file_attachment = file_storage_service.save_file(
                            db,
                            current_user.id,
                            conversation_id,
                            user_message.id,
                            file
                        )
                        uploaded_files.append(file_attachment)
                        logger.info(f"File saved: {file_attachment.filename} (ID: {file_attachment.id})")
                        
                        # Сканируем на вирусы
                        logger.debug(f"Scanning file {file_attachment.filename} for viruses")
                        scan_result = virus_scan_service.scan_file(file_attachment.file_path)
                        logger.info(f"Virus scan result for {file_attachment.filename}: {scan_result['status']}")
                        
                        # Обновляем статус сканирования
                        file_attachment.virus_scan_status = scan_result["status"]
                        file_attachment.virus_scan_date = scan_result["scan_date"]
                        db.commit()
                        
                        # Если сканирование завершилось с ошибкой, логируем, но продолжаем
                        if scan_result["status"] == "error":
                            logger.error(
                                f"Virus scan error for file {file_attachment.original_filename}: "
                                f"{scan_result.get('message', 'Unknown error')}. "
                                f"File will be allowed with warning."
                            )
                            # Продолжаем обработку файла (с предупреждением)
                        
                        # Если файл заражен, удаляем его и отменяем запрос
                        elif scan_result["status"] == "infected":
                            # Удаляем зараженный файл
                            file_storage_service.delete_file(db, file_attachment.id)
                            # Откатываем транзакцию
                            db.rollback()
                            logger.warning(f"Virus detected in file {file.filename} uploaded by user {current_user.id}")
                            raise HTTPException(
                                status_code=status.HTTP_403_FORBIDDEN,
                                detail="File rejected: Virus detected in uploaded file"
                            )
                        
                        # Обрабатываем файл в зависимости от типа
                        try:
                            # Проверяем, является ли файл изображением
                            is_image = file_attachment.file_type and file_attachment.file_type.startswith("image/")
                            
                            if is_image:
                                # Для изображений преобразуем в base64 и добавляем к сообщению
                                try:
                                    # Преобразуем изображение в base64
                                    image_base64 = file_extraction_service.image_to_base64(
                                        file_attachment.file_path
                                    )
                                    
                                    if image_base64:
                                        # Сохраняем base64 для передачи в модель через LangChain
                                        # Добавляем информацию об изображении в текст
                                        metadata = file_extraction_service.extract_image_metadata(
                                            file_attachment.file_path
                                        )
                                        
                                        # Создаем специальный формат для изображения
                                        # Формат: [IMAGE: filename] с base64 data URI
                                        image_info = {
                                            "type": "image",
                                            "filename": file_attachment.original_filename,
                                            "base64": image_base64,
                                            "metadata": metadata
                                        }
                                        
                                        # Сохраняем информацию об изображении для передачи в модель
                                        # Добавляем в extracted_text_parts как словарь для обработки позже
                                        extracted_text_parts.append({
                                            "type": "image",
                                            "content": image_info
                                        })
                                        
                                        # Также добавляем текстовое описание для моделей без vision
                                        formatted_text = file_extraction_service.format_image_metadata_for_message(
                                            file_attachment.original_filename,
                                            metadata
                                        )
                                        # Не добавляем formatted_text в extracted_text_parts, так как уже добавили словарь
                                    else:
                                        # Если не удалось преобразовать в base64, используем метаданные
                                        metadata = file_extraction_service.extract_image_metadata(
                                            file_attachment.file_path
                                        )
                                        formatted_text = file_extraction_service.format_image_metadata_for_message(
                                            file_attachment.original_filename,
                                            metadata
                                        )
                                        extracted_text_parts.append(formatted_text)
                                except Exception as e:
                                    logger.warning(f"Failed to process image {file_attachment.original_filename}: {e}", exc_info=True)
                                    # Fallback: используем стандартный формат
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        "",
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    extracted_text_parts.append(formatted_text)
                            else:
                                # Для остальных файлов извлекаем текст
                                logger.info(f"Extracting text from file: {file_attachment.original_filename} (type: {file_attachment.file_type}, path: {file_attachment.file_path})")
                                extracted_text = file_extraction_service.extract_text(
                                    file_attachment.file_path,
                                    file_attachment.file_type
                                )
                                
                                logger.info(f"Extracted text length: {len(extracted_text) if extracted_text else 0} characters from {file_attachment.original_filename}")
                                
                                if extracted_text:
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        extracted_text,
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    logger.debug(f"Formatted text preview: {formatted_text[:200]}...")
                                    extracted_text_parts.append(formatted_text)
                                else:
                                    # Если извлечение не удалось, добавляем метаданные
                                    logger.warning(f"Failed to extract text from {file_attachment.original_filename}, file may be empty or unsupported")
                                    formatted_text = file_extraction_service.format_extracted_text_for_message(
                                        file_attachment.original_filename,
                                        "",
                                        file_attachment.file_size,
                                        file_attachment.file_type
                                    )
                                    extracted_text_parts.append(formatted_text)
                        except Exception as e:
                            logger.warning(f"Failed to process file {file_attachment.original_filename}: {e}", exc_info=True)
                            # Продолжаем без извлеченного текста
                            formatted_text = file_extraction_service.format_extracted_text_for_message(
                                file_attachment.original_filename,
                                "",
                                file_attachment.file_size,
                                file_attachment.file_type
                            )
                            extracted_text_parts.append(formatted_text)
                except HTTPException:
                    # Если произошла ошибка при обработке файлов, откатываем транзакцию
                    db.rollback()
                    # Удаляем уже сохраненные файлы
                    for file_attachment in uploaded_files:
                        try:
                            file_storage_service.delete_file(db, file_attachment.id)
                        except:
                            pass
                    raise
                
                # Формируем финальное сообщение с файлами
                # Обрабатываем extracted_text_parts, которые могут содержать строки или словари с изображениями
                text_parts = []
                image_parts = []
                
                for part in extracted_text_parts:
                    if isinstance(part, dict) and part.get("type") == "image":
                        # Это изображение - сохраняем для передачи в модель
                        image_parts.append(part["content"])
                        # Добавляем текстовое описание изображения
                        metadata = part["content"].get("metadata", {})
                        formatted_text = file_extraction_service.format_image_metadata_for_message(
                            part["content"]["filename"],
                            metadata
                        )
                        text_parts.append(formatted_text)
                    else:
                        # Это обычный текст
                        text_parts.append(part)
                
                # Формируем финальное сообщение
                if text_parts:
                    message_with_files = "\n".join(text_parts) + "\n\n" + message_content
                    logger.info(f"Message with files created. Text parts: {len(text_parts)}, total message length: {len(message_with_files)} characters")
                    logger.debug(f"Message preview: {message_with_files[:500]}...")
                else:
                    message_with_files = message_content
                    logger.warning(f"No text parts extracted from files, using original message only")
                
                # Сохраняем информацию об изображениях для передачи в модель
                if image_parts:
                    # Сохраняем изображения в request для передачи в generate_response
                    # Используем атрибут request для хранения изображений
                    request.state.image_attachments = image_parts
            else:
                # Нет файлов - используем исходное сообщение
                message_with_files = message_content
            
            # Сохраняем сообщение пользователя (если еще не создано)
            if not user_message:
                # Если есть предзагруженные файлы, создаем сообщение и обновляем message_id
                if not files and uploaded_files:
                    # Файлы предзагружены - создаем сообщение и обновляем message_id для файлов
                    user_message = conversation_service.save_message(
                        conversation_id,
                        message_content,
                        is_from_user=True,
                        folder_service=folder_service
                    )
                    
                    # Обновляем message_id для предзагруженных файлов
                    for file_attachment in uploaded_files:
                        file_attachment.message_id = user_message.id
                    db.commit()
                    logger.info(f"Updated message_id for {len(uploaded_files)} pre-uploaded file(s)")
                elif not files and not uploaded_files:
                    # Нет файлов - создаем обычное сообщение
                    user_message = conversation_service.save_message(
                        conversation_id,
                        message_content,
                        is_from_user=True,
                        folder_service=folder_service
                    )
                # Если files есть, то user_message уже создано в цикле обработки файлов
            
            # Проверяем, является ли это системным чатом
            if conversation and conversation.is_system_chat:
                # Для системного чата НЕ проверяем лимит и НЕ увеличиваем счетчик
                # Просто сохраняем сообщение пользователя без ответа агента
                if not user_message:
                    user_message = conversation_service.save_message(
                        conversation.id, 
                        message_content, 
                        is_from_user=True,
                        folder_service=folder_service
                    )
                
                return {
                    "conversation_id": conversation.id,
                    "user_message": message_content,
                    "agent_response": None,
                    "message_id": user_message.id,
                    "id": user_message.id,
                    "is_system_chat": True,
                    "file_attachments": [
                        {
                            "id": f.id,
                            "filename": f.filename,
                            "original_filename": f.original_filename,
                            "file_size": f.file_size,
                            "file_type": f.file_type,
                            "created_at": f.created_at.isoformat() if f.created_at else None
                        }
                        for f in uploaded_files
                    ] if uploaded_files else []
                }
            
            # Для обычных чатов проверяем лимит сообщений перед отправкой
            if not SubscriptionService.can_send_message(current_user, db):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Message limit exceeded. Please upgrade your subscription."
                )
            
            # Обычная логика для чатов с агентами
            # Проверяем, существует ли агент и активен ли он
            agent = agent_service.get_agent(agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )
            
            if not agent_service.is_agent_active(agent_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Agent is not active"
                )
            
            # Получаем или создаем разговор с агентом
            if not conversation:
                conversation = conversation_service.create_conversation(
                    agent_id, 
                    f"Чат с {agent.name}", 
                    current_user.id, 
                    folder_service
                )
                
                # Добавляем чат в папку "Персонажи" для персонажей
                if folder_service and agent.category:
                    category_lower = agent.category.lower()
                    if category_lower in {"chats", "персонаж", "characters", "character"}:
                        try:
                            success = folder_service.add_chat_to_system_folder_by_name(
                                current_user.id, 
                                "Персонажи", 
                                conversation.id
                            )
                            if not success:
                                logger.warning(
                                    f"Failed to add chat {conversation.id} to 'Персонажи' folder for user {current_user.id}"
                                )
                        except Exception as e:
                            logger.error(f"Error adding chat to 'Персонажи' folder: {e}", exc_info=True)
            
            # Увеличиваем счетчик сообщений пользователя
            if not SubscriptionService.increment_message_count(db, current_user):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Message limit exceeded. Please upgrade your subscription."
                )
            
            # Сохраняем сообщение пользователя (если еще не создано при обработке файлов)
            if not user_message:
                user_message = conversation_service.save_message(
                    conversation.id, 
                    message_content, 
                    is_from_user=True,
                    folder_service=folder_service
                )
                
                # Если файлы были загружены через multipart (не предзагружены), 
                # они уже имеют message_id, так что ничего не делаем
                # Но если файлы были предзагружены, мы уже обновили message_id выше
            
            # Генерируем ответ агента через LangChain (используем message_with_files с извлеченным текстом)
            # Передаем изображения, если они есть
            image_attachments = getattr(request.state, 'image_attachments', None) if hasattr(request, 'state') else None
            
            # Получаем язык из запроса, если не указан - определится автоматически из сообщения
            language = None
            if is_multipart:
                language = form.get("language")
            else:
                # Используем уже прочитанное тело запроса
                if request_body is None:
                    request_body = await request.json()
                language = request_body.get("language") if isinstance(request_body, dict) else None
            
            # Если язык не передан явно, он будет определен автоматически в agent_service.generate_response
            # из содержимого сообщения пользователя
            
            logger.info(f"📤 [CHAT SEND] Вызов generate_response: agent_id={agent_id}, conversation_id={conversation.id}, message_length={len(message_with_files) if message_with_files else 0}")
            
            agent_response = await agent_service.generate_response(
                agent_id, 
                message_with_files,  # Используем сообщение с извлеченным текстом из файлов
                conversation_id=str(conversation.id),
                image_attachments=image_attachments,  # Передаем изображения для моделей с vision
                language=language  # Передаем язык для ответа (если None, определится автоматически)
            )
            
            logger.info(f"📥 [CHAT SEND] Получен ответ от агента: type={type(agent_response).__name__}, response_length={len(str(agent_response)) if agent_response else 0}")
            
            # Обрабатываем ответ агента (может быть строкой или словарем с изображением)
            agent_response_text = agent_response
            agent_image_data = None
            
            if isinstance(agent_response, dict):
                logger.debug(f"📦 [CHAT SEND] Ответ - словарь, ключи: {list(agent_response.keys())}")
                agent_response_text = agent_response.get("text", "")
                agent_image_data = agent_response.get("image")
                
                logger.debug(f"📝 [CHAT SEND] Текст из словаря: '{agent_response_text[:100] if agent_response_text else 'ПУСТО'}...'")
                logger.debug(f"🖼️ [CHAT SEND] Изображение в словаре: {agent_image_data is not None}")
                
                # Если текст пустой, но есть изображение, добавляем дефолтный текст
                if not agent_response_text or (isinstance(agent_response_text, str) and len(agent_response_text.strip()) == 0):
                    if agent_image_data:
                        agent_response_text = "Вот сгенерированное изображение."
                        logger.info(f"✅ [CHAT SEND] Добавлен дефолтный текст для сообщения с изображением")
                    else:
                        logger.warning(f"⚠️ [CHAT SEND] Пустой текст и нет изображения в словаре")
                
                if agent_image_data:
                    logger.info(f"🖼️ [CHAT SEND] Обнаружено изображение в ответе агента")
            elif isinstance(agent_response, str):
                logger.debug(f"📝 [CHAT SEND] Ответ - строка: '{agent_response[:100]}...'")
            else:
                logger.warning(f"⚠️ [CHAT SEND] Неожиданный тип ответа: {type(agent_response).__name__}")
                agent_response_text = str(agent_response) if agent_response else ""
            
            # Проверяем, что текст не пустой
            if not agent_response_text or (isinstance(agent_response_text, str) and len(agent_response_text.strip()) == 0):
                logger.warning(f"⚠️ [CHAT SEND] Получен пустой ответ от агента, используем fallback")
                agent_response_text = "Извините, не удалось сгенерировать ответ. Пожалуйста, попробуйте еще раз."
            
            logger.info(f"💾 [CHAT SEND] Сохраняем сообщение с текстом длиной {len(agent_response_text)} символов")
            
            # Сохраняем ответ агента
            agent_message = conversation_service.save_message(
                conversation.id, 
                agent_response_text, 
                is_from_user=False, 
                agent_id=agent_id,
                folder_service=folder_service
            )
            
            # Если есть изображение, сохраняем его как файл
            if agent_image_data and agent_message:
                try:
                    from services.file_storage_service import FileStorageService
                    from services.file_extraction_service import FileExtractionService
                    import base64
                    import uuid
                    from pathlib import Path
                    from datetime import datetime
                    
                    file_storage_service = FileStorageService()
                    file_extraction_service = FileExtractionService()
                    
                    # Извлекаем base64 данные
                    image_base64 = agent_image_data.get("base64")
                    if not image_base64 and agent_image_data.get("url"):
                        # Если нет base64, но есть URL, скачиваем изображение
                        from services.image_generation_service import ImageGenerationService
                        img_service = ImageGenerationService()
                        image_base64 = await img_service.download_image_as_base64(agent_image_data["url"])
                    
                    if image_base64:
                        # Декодируем base64
                        if image_base64.startswith("data:"):
                            # Удаляем префикс data:image/...;base64,
                            base64_data = image_base64.split(",", 1)[1]
                            content_type = image_base64.split(";")[0].split(":")[1]
                        else:
                            base64_data = image_base64
                            content_type = "image/png"
                        
                        image_bytes = base64.b64decode(base64_data)
                        
                        # Определяем расширение файла
                        extension = "png"
                        if "jpeg" in content_type or "jpg" in content_type:
                            extension = "jpg"
                        elif "webp" in content_type:
                            extension = "webp"
                        
                        # Сохраняем файл
                        filename = f"{uuid.uuid4()}.{extension}"
                        upload_dir = file_storage_service._get_upload_dir(current_user.id, conversation.id)
                        upload_dir.mkdir(parents=True, exist_ok=True)
                        file_path = upload_dir / filename
                        
                        with open(file_path, "wb") as f:
                            f.write(image_bytes)
                        
                        # Создаем запись в БД
                        from models.file_attachment import FileAttachment
                        file_attachment = FileAttachment(
                            filename=filename,
                            original_filename=f"generated_image.{extension}",
                            file_path=str(file_path),
                            file_size=len(image_bytes),
                            file_type=content_type,
                            file_extension=extension,
                            user_id=current_user.id,
                            conversation_id=conversation.id,
                            message_id=agent_message.id,
                            virus_scan_status="clean",  # Генерированные изображения считаем безопасными
                            created_at=datetime.utcnow()
                        )
                        db.add(file_attachment)
                        db.commit()
                        db.refresh(file_attachment)
                        
                        logger.info(f"✅ [CHAT SEND] Изображение сохранено: {file_attachment.id}")
                except Exception as e:
                    logger.error(f"❌ [CHAT SEND] Ошибка при сохранении изображения: {e}", exc_info=True)
                    # Продолжаем выполнение даже если не удалось сохранить изображение
            
            # Получаем актуальные файлы из базы данных для user_message
            user_message_file_attachments = []
            if user_message and uploaded_files:
                # Загружаем файлы из базы данных для user_message
                from models.file_attachment import FileAttachment
                from sqlmodel import select
                attachments = db.exec(
                    select(FileAttachment).where(FileAttachment.message_id == user_message.id)
                ).all()
                user_message_file_attachments = [
                    {
                        "id": f.id,
                        "filename": f.filename,
                        "original_filename": f.original_filename,
                        "file_size": f.file_size,
                        "file_type": f.file_type,
                        "created_at": f.created_at.isoformat() if f.created_at else None
                    }
                    for f in attachments
                ]
            
            # Получаем файлы агента (включая сгенерированные изображения)
            agent_file_attachments = []
            if agent_message:
                from models.file_attachment import FileAttachment
                from sqlmodel import select
                agent_attachments = db.exec(
                    select(FileAttachment).where(FileAttachment.message_id == agent_message.id)
                ).all()
                agent_file_attachments = [
                    {
                        "id": f.id,
                        "filename": f.filename,
                        "original_filename": f.original_filename,
                        "file_size": f.file_size,
                        "file_type": f.file_type,
                        "created_at": f.created_at.isoformat() if f.created_at else None
                    }
                    for f in agent_attachments
                ]
            
            return {
                "conversation_id": conversation.id,
                "user_message": message_content,
                "agent_response": agent_response_text,  # Возвращаем текст ответа
                "agent_image": agent_image_data,  # Возвращаем данные изображения, если есть
                "message_id": agent_message.id,
                "id": agent_message.id,
                "is_system_chat": False,
                "file_attachments": user_message_file_attachments if user_message_file_attachments else (
                    [
                        {
                            "id": f.id,
                            "filename": f.filename,
                            "original_filename": f.original_filename,
                            "file_size": f.file_size,
                            "file_type": f.file_type,
                            "created_at": f.created_at.isoformat() if f.created_at else None
                        }
                        for f in uploaded_files
                    ] if uploaded_files else []
                ),
                "agent_file_attachments": agent_file_attachments  # Файлы от агента (включая изображения)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )

    @app.get("/conversations/system-chat")
    def get_system_chat(current_user: User = Depends(get_current_active_user)):
        """Получить системный чат 'Saved Messages' пользователя"""
        try:
            system_chat = conversation_service.get_system_chat(current_user.id)
            if not system_chat:
                system_chat = conversation_service.create_system_chat(current_user.id)
            
            return system_chat
        except Exception as e:
            logger.error(f"Error in get_system_chat: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting system chat"
            )

    @app.get("/conversations/")
    def read_conversations(
        current_user: User = Depends(get_current_active_user),
        agent_id: Optional[int] = Query(None, description="Фильтр по ID агента"),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        limit: int = Query(100, le=100, ge=1, description="Количество записей"),
    ):
        """Получить список разговоров (включая каналы, на которые пользователь подписан)"""
        try:
            offset, limit = validate_pagination_params(offset, limit)
            return conversation_service.get_conversations(current_user.id, agent_id, offset, limit)
        except Exception as e:
            logger.error(f"Error getting conversations: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error getting conversations"
            )

    @app.put("/conversations/{conversation_id}/title")
    def update_conversation_title(
        conversation_id: int,
        request: ConversationTitleRequest,
        current_user: User = Depends(get_current_active_user)
    ):
        """Обновить название разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Валидация названия
            if not request.title or not request.title.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Название не может быть пустым"
                )
            
            if len(request.title.strip()) > 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Название не может быть длиннее 200 символов"
                )
            
            # Сохраняем название в БД
            logger.info(f"💾 Сохранение названия '{request.title}' для беседы {conversation_id}")
            success = conversation_service.set_title(conversation_id, request.title.strip())
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
            
            # Получаем обновленный разговор для подтверждения
            updated_conversation = conversation_service.get_conversation(conversation_id)
            logger.info(f"✅ Название сохранено в БД для беседы {conversation_id}: {updated_conversation.title if updated_conversation else None}")
            
            return {"ok": True, "title": updated_conversation.title if updated_conversation else None}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating conversation title for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error updating conversation title: {str(e)}"
            )
    
    @app.get("/conversations/{conversation_id}", response_model=ConversationPublic)
    def read_conversation(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить разговор по ID"""
        return verify_conversation_access(conversation_id, current_user, read_only=True)
    
    @app.post("/chat/save-note")
    async def save_note_to_conversation(
        note: SaveNoteRequest,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Сохранить заметку в разговор БЕЗ вызова агента (для режима "История покупок")
        
        Используется для сохранения заметок, которые не требуют ответа агента.
        Полезно для режима "История покупок", где пользователь просто фиксирует траты.
        """
        try:
            # Валидация сообщения
            if not note.message or not note.message.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Message cannot be empty"
                )
            
            if len(note.message) > 7500:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Message is too long (max 7500 characters)"
                )
            
            # Проверяем права доступа к разговору
            verify_conversation_access(note.conversation_id, current_user)
            
            # Сохраняем сообщение как заметку (от пользователя, без ответа агента)
            saved_message = conversation_service.save_message(
                conversation_id=note.conversation_id,
                content=note.message.strip(),
                is_from_user=True,
                agent_id=None,
                folder_service=folder_service
            )
            
            logger.info(f"Note saved to conversation {note.conversation_id} by user {current_user.id}")
            
            return {
                "ok": True,
                "message": "Note saved successfully",
                "message_id": saved_message.id,
                "conversation_id": note.conversation_id
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error saving note to conversation: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error saving note"
            )

    @app.get("/conversations/{conversation_id}/messages")
    def read_conversation_messages(
        conversation_id: int,
        current_user: User = Depends(get_current_active_user),
        offset: int = Query(0, ge=0, description="Смещение для пагинации (количество уже загруженных сообщений, используется только если before_date не указан)"),
        max_chars: int = Query(10000, ge=1, le=50000, description="Максимальное количество символов для загрузки"),
        before_date: Optional[str] = Query(None, description="ISO строка даты - загружать сообщения, которые были созданы ДО этой даты (для правильной подгрузки старых)"),
    ):
        """Получить сообщения из разговора с лимитом по символам"""
        verify_conversation_access(conversation_id, current_user, read_only=True)
        return conversation_service.get_conversation_messages(conversation_id, offset, max_chars, before_date)

    @app.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_conversation(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить разговор и все его сообщения"""
        verify_conversation_access(conversation_id, current_user)
        
        success = conversation_service.delete_conversation(conversation_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        return None
    
    @app.post("/conversations/{conversation_id}/messages/{message_id}/pin")
    def pin_message(
        conversation_id: int, 
        message_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Закрепить сообщение в разговоре"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = conversation_service.pin_message(conversation_id, message_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message or conversation not found"
                )
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error pinning message {message_id} in conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error pinning message"
            )
    
    @app.delete("/conversations/{conversation_id}/messages/pin")
    def unpin_message(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Открепить сообщение в разговоре"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = conversation_service.unpin_message(conversation_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No pinned message found"
                )
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error unpinning message in conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error unpinning message"
            )
    
    @app.get("/conversations/{conversation_id}/pinned-message")
    def get_pinned_message(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить закрепленное сообщение разговора"""
        verify_conversation_access(conversation_id, current_user)
        
        pinned_message = conversation_service.get_pinned_message(conversation_id)
        if not pinned_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pinned message found"
            )
        return pinned_message
    
    @app.get("/conversations/{conversation_id}/pinned-messages")
    def get_pinned_messages(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить все закрепленные сообщения разговора"""
        verify_conversation_access(conversation_id, current_user)
        return conversation_service.get_pinned_messages(conversation_id)
    
    @app.get("/conversations/{conversation_id}/user-rules")
    def get_user_rules(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить правила пользователя для разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            rules = conversation_service.get_user_rules(conversation_id)
            return {"rules": rules}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting user rules for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting user rules: {str(e)}"
            )
    
    @app.put("/conversations/{conversation_id}/user-rules")
    def update_user_rules(
        conversation_id: int,
        request: UserRulesRequest,
        current_user: User = Depends(get_current_active_user)
    ):
        """Обновить правила пользователя для разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Валидация: максимум 50 правил, каждое правило максимум 1000 символов
            if len(request.rules) > 50:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Превышен лимит правил (максимум 50)"
                )
            
            for rule in request.rules:
                if len(rule) > 1000:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Превышен лимит символов для правила (максимум 1000 символов)"
                    )
            
            # Сохраняем правила в БД
            logger.info(f"💾 Сохранение {len(request.rules)} правил для беседы {conversation_id}: {request.rules}")
            success = conversation_service.set_user_rules(conversation_id, request.rules)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
            
            # Проверяем, что правила сохранились
            saved_rules = conversation_service.get_user_rules(conversation_id)
            logger.info(f"✅ Правила сохранены в БД для беседы {conversation_id}: {saved_rules}")
            
            # Очищаем системное сообщение в памяти LangChain для всех возможных conversation_id
            # (для обычных и мульти-агентных чатов)
            try:
                agent_service.clear_conversation_system_message(str(conversation_id))
                # Также очищаем для возможных мульти-агентных conversation_id
                # Но это не критично, так как системное сообщение будет обновлено при следующем запросе
                logger.debug(f"Системное сообщение очищено для беседы {conversation_id}")
            except Exception as e:
                logger.warning(f"⚠️ Не удалось очистить системное сообщение для беседы {conversation_id}: {e}")
            
            return {"ok": True, "rules": saved_rules}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating user rules for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error updating user rules: {str(e)}"
            )
    
    @app.put("/conversations/{conversation_id}/selected-model")
    def update_selected_model(
        conversation_id: int,
        request: SelectedModelRequest,
        current_user: User = Depends(get_current_active_user)
    ):
        """Обновить выбранную модель для разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Валидация модели
            if not request.model or not request.model.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Модель не может быть пустой"
                )
            
            # Сохраняем модель в БД
            logger.info(f"💾 Сохранение модели {request.model} для беседы {conversation_id}")
            success = conversation_service.set_selected_model(conversation_id, request.model.strip())
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
            
            # Получаем сохраненную модель для подтверждения
            saved_model = conversation_service.get_selected_model(conversation_id)
            logger.info(f"✅ Модель сохранена в БД для беседы {conversation_id}: {saved_model}")
            
            return {"ok": True, "model": saved_model}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating selected model for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error updating selected model: {str(e)}"
            )
    
    @app.get("/conversations/{conversation_id}/selected-model")
    def get_selected_model(
        conversation_id: int,
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить выбранную модель для разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            model = conversation_service.get_selected_model(conversation_id)
            return {"model": model}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting selected model for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting selected model: {str(e)}"
            )
    
    @app.delete("/conversations/{conversation_id}/messages/{message_id}/pin")
    def unpin_specific_message(
        conversation_id: int, 
        message_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Открепить конкретное сообщение в разговоре"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = conversation_service.unpin_specific_message(conversation_id, message_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message not found or not pinned"
                )
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error unpinning message {message_id} in conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error unpinning message"
            )
    
    @app.delete("/messages/{message_id}")
    def delete_message(
        message_id: int, 
        current_user: User = Depends(get_current_active_user), 
        session: Session = Depends(get_session)
    ):
        """Удалить сообщение"""
        message = session.get(Message, message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        # Проверяем права доступа через conversation или multi_agent_conversation
        if message.conversation_id:
            conversation = session.get(Conversation, message.conversation_id)
            if not conversation or conversation.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        elif message.multi_agent_conversation_id:
            multi_conv = session.get(MultiAgentConversation, message.multi_agent_conversation_id)
            if not multi_conv or multi_conv.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Message has no associated conversation"
            )
        
        success = conversation_service.delete_message(message_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        return {"ok": True}
    
    @app.put("/system-chat-visibility", response_model=UserResponse)
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
            logger.error(f"Error updating system chat visibility: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить настройку"
            )
    
    @app.post("/conversations/{conversation_id}/mark-as-read")
    def mark_conversation_as_read(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Пометить чат как прочитанный"""
        verify_conversation_access(conversation_id, current_user)
        conversation_service.reset_unread_count(conversation_id)
        return {"ok": True, "message": "Conversation marked as read", "unread_count": 0}
    
    @app.post("/conversations/{conversation_id}/clear")
    def clear_conversation_messages(
        conversation_id: int, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Очистить все сообщения из разговора"""
        verify_conversation_access(conversation_id, current_user)
        
        try:
            success = conversation_service.clear_conversation_messages(conversation_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to clear conversation messages"
                )
            
            logger.info(f"Successfully cleared conversation {conversation_id} for user {current_user.id}")
            return {"ok": True, "message": "Conversation messages cleared successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error clearing conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to clear conversation messages"
            )
    
    @app.post("/chat/check-test-answers")
    async def check_test_answers(
        request: CheckTestAnswersRequest,
        current_user: User = Depends(get_current_active_user)
    ):
        """Проверить ответы на тест через LLM
        
        Принимает список вопросов и ответов, отправляет их на проверку агенту
        и возвращает результаты проверки в формате JSON.
        """
        try:
            agent_id = validate_agent_id(request.agent_id)
            
            # Проверяем, существует ли агент и активен ли он
            agent = agent_service.get_agent(agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )
            
            if not agent_service.is_agent_active(agent_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Agent is not active"
                )
            
            # Формируем запрос для LLM
            check_request = "Проверь мои ответы на тест:\n\n" + "\n\n".join(
                f"{i + 1}. Вопрос: {q.question}\nМой ответ: {q.answer}"
                for i, q in enumerate(request.questions)
            )
            
            # Добавляем инструкцию для возврата только JSON
            check_request += "\n\nВерни ТОЛЬКО JSON в формате: {\"results\": [{\"question_id\": \"1\", \"is_correct\": true}, {\"question_id\": \"2\", \"is_correct\": false}, ...]}. НЕ пиши объяснения, НЕ пиши текст, ТОЛЬКО JSON с результатами проверки."
            
            # Проверяем доступ к беседе (если она указана)
            conversation_id = request.conversation_id
            if conversation_id:
                verify_conversation_access(conversation_id, current_user, read_only=True)
            
            # Вызываем LLM для проверки ответов
            # В conversation_id передаем текущую беседу, чтобы сохранить контекст последнего теста в память агента
            # generate_response автоматически сохраняет сообщение в память LangChain для этой беседы
            # НЕ сохраняем сообщение в БД, чтобы оно не появлялось в чате как видимое сообщение
            response_text = await agent_service.generate_response(
                agent_id=agent_id,
                message=check_request,
                conversation_id=str(conversation_id) if conversation_id else None,
                language=None
            )
            
            # Пытаемся извлечь JSON из ответа
            # Ищем JSON в ответе (может быть обернут в ```json``` или просто текст)
            json_match = re.search(r'\{[\s\S]*"results"[\s\S]*\}', response_text)
            if json_match:
                try:
                    results = json.loads(json_match.group(0))
                    if results.get("results") and isinstance(results["results"], list):
                        # Сохраняем ответы в БД, если указаны test_id и conversation_id
                        if request.test_id and conversation_id:
                            try:
                                # Формируем данные для сохранения
                                answers_to_save = []
                                for result in results["results"]:
                                    # Находим соответствующий вопрос
                                    question_data = next(
                                        (q for q in request.questions if q.question_id == result["question_id"]),
                                        None
                                    )
                                    if question_data:
                                        answers_to_save.append({
                                            "question_id": result["question_id"],
                                            "question": question_data.question,
                                            "answer": question_data.answer,
                                            "is_correct": result.get("is_correct", False)
                                        })
                                
                                # Сохраняем в БД
                                test_answer_service.save_test_answers(
                                    test_id=request.test_id,
                                    conversation_id=conversation_id,
                                    agent_id=agent_id,
                                    answers=answers_to_save
                                )
                                logger.info(f"Saved test answers to DB: test_id={request.test_id}, conversation_id={conversation_id}")
                            except Exception as e:
                                logger.warning(f"Failed to save test answers to DB: {e}")
                        
                        # Возвращаем результаты проверки
                        return {
                            "ok": True,
                            "results": results["results"]
                        }
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse JSON from LLM response: {response_text[:200]}")
            
            # Если не удалось извлечь JSON, возвращаем ошибку
            logger.error(f"LLM response does not contain valid JSON: {response_text[:500]}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to parse test results from LLM response"
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error checking test answers: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error checking test answers: {str(e)}"
            )
    
    @app.get("/chat/test-results/{test_id}")
    async def get_test_results(
        test_id: str,
        conversation_id: int = Query(...),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить результаты теста с аналитикой"""
        try:
            # Проверяем доступ к беседе
            verify_conversation_access(conversation_id, current_user, read_only=True)
            
            # Получаем результаты теста
            test_results = test_answer_service.get_test_results(test_id, conversation_id)
            
            if not test_results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Test results not found"
                )
            
            return test_results
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting test results: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting test results: {str(e)}"
            )
    
    @app.get("/chat/latest-test-results")
    async def get_latest_test_results(
        conversation_id: int = Query(...),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить результаты последнего теста в беседе"""
        try:
            # Проверяем доступ к беседе
            verify_conversation_access(conversation_id, current_user, read_only=True)
            
            # Получаем результаты последнего теста
            test_results = test_answer_service.get_latest_test_result(conversation_id)
            
            if not test_results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No test results found for this conversation"
                )
            
            return test_results
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting latest test results: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting latest test results: {str(e)}"
            )
    
    @app.post("/chat/test-analytics")
    async def get_test_analytics(
        test_id: str = Body(...),
        conversation_id: int = Body(...),
        agent_id: int = Body(...),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить аналитику теста от агента"""
        try:
            # Проверяем доступ к беседе
            verify_conversation_access(conversation_id, current_user, read_only=True)
            
            # Проверяем агента
            agent = agent_service.get_agent(agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Agent not found"
                )
            
            if not agent_service.is_agent_active(agent_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Agent is not active"
                )
            
            # Получаем результаты теста из БД
            test_results = test_answer_service.get_test_results(test_id, conversation_id)
            if not test_results:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Test results not found"
                )
            
            # Формируем запрос для агента на анализ
            analytics_request = "Проанализируй мои ответы на тест. Покажи детальный анализ каждого вопроса в следующем формате:\n\n"
            
            for answer in test_results.answers:
                question_num = answer.question_id
                user_answer = answer.user_answer if answer.user_answer else "(пусто)"
                is_correct = "Верно" if answer.is_correct else "Неверно"
                
            analytics_request += f"{question_num}. Вопрос {question_num}:\n\n"
            analytics_request += f"Ваш ответ: {user_answer}\n"
            analytics_request += f"Правильный ответ: {answer.question_text}\n"
            analytics_request += f"Результат: {is_correct}"
            if not answer.is_correct and user_answer != "(пусто)":
                analytics_request += " (ответ неверный)"
            elif user_answer == "(пусто)":
                analytics_request += " (ответ отсутствует)"
            elif answer.is_correct and user_answer.lower() != answer.question_text.lower():
                analytics_request += " (принято как правильный, несмотря на различия в написании)"
            analytics_request += ".\n"
            analytics_request += "Разъяснение: Объясни, почему правильный ответ именно такой, и что нужно знать по этому вопросу.\n\n"
            
            analytics_request += "\nВ конце добавь раздел '### Рекомендации:' с советами по темам, которые нужно повторить."
            analytics_request += "\n\nВАЖНО: Используй форматирование markdown (**текст** для выделения). Структура должна быть четкой: каждый вопрос начинается с номера и слова 'Вопрос', затем идут 'Ваш ответ:', 'Правильный ответ:', 'Результат:' и 'Разъяснение:'."
            
            # Вызываем агента для получения аналитики
            # НЕ сохраняем запрос пользователя в БД, чтобы он не появлялся в чате
            # Но сохраняем ответ агента явно
            logger.info(f"🔄 Requesting analytics from agent {agent_id} for conversation {conversation_id}")
            analytics_response = await agent_service.generate_response(
                agent_id=agent_id,
                message=analytics_request,
                conversation_id=str(conversation_id),
                language=None
            )
            logger.info(f"✅ Analytics received from agent, length: {len(analytics_response)}")
            
            # Сохраняем ответ агента в БД как сообщение от агента
            logger.info(f"🔄 Attempting to save analytics message: conversation_id={conversation_id}, agent_id={agent_id}, content_length={len(analytics_response)}")
            try:
                saved_message = conversation_service.save_message(
                    conversation_id=conversation_id,
                    content=analytics_response,
                    is_from_user=False,
                    agent_id=agent_id,
                    folder_service=folder_service
                )
                logger.info(f"✅ Analytics message saved successfully: message_id={saved_message.id if saved_message else 'None'}, conversation_id={conversation_id}, agent_id={agent_id}")
            except Exception as save_error:
                logger.error(f"❌ Failed to save analytics message: {save_error}", exc_info=True)
                # Не прерываем выполнение, просто логируем ошибку
                # Сообщение все равно вернется в ответе, и фронтенд может его обработать
            
            return {
                "ok": True,
                "analytics": analytics_response
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting test analytics: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting test analytics: {str(e)}"
            )
