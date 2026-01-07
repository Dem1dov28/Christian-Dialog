from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, func
import logging
import re

from models.conversation import Conversation, ConversationPublic
from models.message import Message, MessagePublic
from models.agent import Agent
from models.multi_agent_conversation import MultiAgentConversation
from services.base_service import BaseService
from services.file_storage_service import FileStorageService

logger = logging.getLogger(__name__)


class ConversationService(BaseService):
    """Сервис для работы с разговорами"""
    
    def __init__(self):
        super().__init__()
        self.file_storage_service = FileStorageService()

    def increment_unread_count(
        self, conversation_id: int, is_group_chat: bool = False
    ) -> bool:
        """Увеличить счетчик непрочитанных сообщений."""
        try:
            with self.get_session() as session:
                conversation = self._get_unread_conversation(
                    session, conversation_id, is_group_chat
                )
                if not conversation or getattr(conversation, "is_system_chat", False):
                    return False

                conversation.unread_count = (conversation.unread_count or 0) + 1
                session.commit()
                return True
        except Exception as exc:
            logger.error(
                f"Failed to increment unread count for conversation {conversation_id}: {exc}",
                exc_info=True,
            )
            return False

    def reset_unread_count(
        self, conversation_id: int, is_group_chat: bool = False
    ) -> bool:
        """Сбросить счетчик непрочитанных сообщений."""
        try:
            with self.get_session() as session:
                conversation = self._get_unread_conversation(
                    session, conversation_id, is_group_chat
                )
                if not conversation or getattr(conversation, "is_system_chat", False):
                    return False

                if conversation.unread_count:
                    conversation.unread_count = 0
                    session.commit()
                return True
        except Exception as exc:
            logger.error(
                f"Failed to reset unread count for conversation {conversation_id}: {exc}",
                exc_info=True,
            )
            return False

    def get_unread_count(
        self, conversation_id: int, is_group_chat: bool = False
    ) -> int:
        """Получить текущее значение счетчика непрочитанных сообщений."""
        try:
            with self.get_session() as session:
                conversation = self._get_unread_conversation(
                    session, conversation_id, is_group_chat
                )
                if not conversation:
                    return 0
                return conversation.unread_count or 0
        except Exception as exc:
            logger.error(
                f"Failed to fetch unread count for conversation {conversation_id}: {exc}",
                exc_info=True,
            )
            return 0

    def _get_unread_conversation(
        self, session: Session, conversation_id: int, is_group_chat: bool
    ):
        if is_group_chat:
            return session.get(MultiAgentConversation, conversation_id)
        return session.get(Conversation, conversation_id)
    
    def create_system_chat(self, user_id: int, chat_type: str = "saved_messages") -> Dict[str, Any]:
        """Создать системный чат для пользователя"""
        # Обеспечиваем существование поля is_system_chat
        from core.database import ensure_conversation_system_chat_column
        ensure_conversation_system_chat_column()
        
        with self.get_session() as session:
            # Проверяем, не существует ли уже системный чат этого типа для пользователя
            try:
                existing_chat = session.exec(
                    select(Conversation)
                    .where(Conversation.user_id == user_id)
                    .where(Conversation.is_system_chat == True)
                    .where(Conversation.title == "Saved Messages")
                ).first()
            except Exception as e:
                logger.warning(f"Error querying existing system chat: {e}")
                # Fallback: ищем по названию без проверки is_system_chat
                existing_chat = session.exec(
                    select(Conversation)
                    .where(Conversation.user_id == user_id)
                    .where(Conversation.title == "Saved Messages")
                ).first()
            
            if existing_chat:
                return self._format_conversation_dict(existing_chat)
            
            # Создаем системный чат
            # Системный чат не имеет агента (agent_id=None)
            conversation = Conversation(
                agent_id=None,  # Системный чат без агента
                title="Saved Messages",
                user_id=user_id,
                is_system_chat=True
            )
            session.add(conversation)
            session.commit()
            session.refresh(conversation)
            
            return self._format_conversation_dict(conversation)
    
    def get_system_chat(self, user_id: int, chat_type: str = "saved_messages") -> Optional[Dict[str, Any]]:
        """Получить системный чат пользователя"""
        # Обеспечиваем существование поля is_system_chat
        from core.database import ensure_conversation_system_chat_column
        ensure_conversation_system_chat_column()
        
        with self.get_session() as session:
            # Используем raw SQL для избежания проблем с SQLModel, если поле отсутствует
            try:
                conversation = session.exec(
                    select(Conversation)
                    .where(Conversation.user_id == user_id)
                    .where(Conversation.is_system_chat == True)
                    .where(Conversation.title == "Saved Messages")
                ).first()
            except Exception as e:
                logger.warning(f"Error querying system chat: {e}")
                # Fallback: ищем по названию без проверки is_system_chat
                conversation = session.exec(
                    select(Conversation)
                    .where(Conversation.user_id == user_id)
                    .where(Conversation.title == "Saved Messages")
                ).first()
            
            if conversation:
                return self._format_conversation_dict(conversation)
            return None
    
    def create_conversation(
        self, 
        agent_id: Optional[int], 
        title: Optional[str], 
        user_id: int, 
        folder_service=None,
        conversation_type: str = "agents_only"
    ) -> ConversationPublic:
        """Создать новый разговор с персонажем
        
        Args:
            agent_id: ID агента (персонажа)
            title: Название разговора
            user_id: ID пользователя
            folder_service: Сервис папок (опционально)
            conversation_type: Тип чата (только 'agents_only')
            
        Returns:
            Созданный разговор
            
        Raises:
            Exception: При ошибке создания разговора
        """
        try:
            with self.get_session() as session:
                # Валидация типа чата
                if conversation_type != "agents_only":
                    raise ValueError(f"Invalid conversation_type: {conversation_type}. Only 'agents_only' is supported.")
                
                # Проверяем, что agent_id указан
                if agent_id is None:
                    raise ValueError("agent_id required for conversation")
                
                # Определяем самую слабую модель по умолчанию для категории агента
                default_model = None
                if agent_id:
                    # Получаем информацию об агенте
                    agent = session.get(Agent, agent_id)
                    if agent:
                        agent_name = (agent.name or "").lower()
                        agent_category = (agent.category or "").lower()
                        
                        # Определяем категорию модели на основе имени агента
                        model_category = None
                        if "chatgpt" in agent_name or "gpt" in agent_name:
                            model_category = "ChatGPT"
                        elif "claude" in agent_name:
                            model_category = "Claude"
                        elif "grok" in agent_name:
                            model_category = "Grok"
                        elif "deepseek" in agent_name or "deep seek" in agent_name:
                            model_category = "DeepSeek"
                        elif "gemini" in agent_name:
                            model_category = "Gemini"
                        
                        # Если не удалось определить по имени, проверяем категорию агента
                        if not model_category and "models" in agent_category:
                            # Пытаемся определить по категории
                            if "chatgpt" in agent_category or "gpt" in agent_category:
                                model_category = "ChatGPT"
                            elif "claude" in agent_category:
                                model_category = "Claude"
                            elif "grok" in agent_category:
                                model_category = "Grok"
                            elif "deepseek" in agent_category or "deep seek" in agent_category:
                                model_category = "DeepSeek"
                            elif "gemini" in agent_category:
                                model_category = "Gemini"
                        
                        # Выбираем самую слабую модель для категории (последняя в списке)
                        if model_category == "ChatGPT":
                            default_model = "openai/gpt-3.5-turbo"  # Самая слабая модель ChatGPT
                        elif model_category == "Claude":
                            default_model = "anthropic/claude-3.7-sonnet:thinking"  # Самая слабая модель Claude
                        elif model_category == "Grok":
                            default_model = "x-ai/grok-3-mini"  # Самая слабая модель Grok
                        elif model_category == "DeepSeek":
                            default_model = "deepseek/deepseek-r1-0528:free"  # Самая слабая модель DeepSeek
                        elif model_category == "Gemini":
                            default_model = "google/gemini-2.5-pro"  # Самая слабая модель Gemini
                
                # Если не удалось определить модель для категории, используем общую самую слабую
                if not default_model:
                    default_model = "openai/gpt-3.5-turbo"  # Общая самая слабая модель по умолчанию
                
                # Всегда создаем новый разговор - каждый чат должен быть независимым
                conversation = Conversation(
                    agent_id=agent_id,
                    title=title,
                    user_id=user_id,
                    conversation_type=conversation_type,
                    selected_model=default_model  # Устанавливаем самую слабую модель для категории агента
                )
                session.add(conversation)
                session.flush()  # Используем flush вместо commit
                session.refresh(conversation)
                
                # Привязка к системной папке "Персонажи" для персонажей (только для agents_only)
                if folder_service and conversation_type == "agents_only" and agent_id:
                    try:
                        # Используем уже загруженного агента, если он есть
                        if not agent:
                            agent = session.get(Agent, agent_id)
                        if agent and (agent.category or "").lower() in {"chats", "персонаж", "characters", "character"}:
                            success = folder_service.add_chat_to_system_folder_by_name(user_id, "Персонажи", conversation.id, session)
                            if not success:
                                logger.warning(f"Не удалось добавить чат {conversation.id} в папку 'Персонажи' для пользователя {user_id}")
                    except Exception as e:
                        logger.error(f"Ошибка при добавлении чата в папку 'Персонажи': {e}", exc_info=True)
                    # Перемещаем новый чат на первое место во всех папках пользователя
                    folder_service.move_chat_to_top_in_all_folders(conversation.id, user_id, session)
                    session.commit()  # Коммитим все изменения вместе
                else:
                    session.commit()
                
                logger.info(f"Successfully created conversation {conversation.id} for user {user_id}")
                return ConversationPublic.model_validate(conversation)
        except Exception as e:
            logger.error(f"Error creating conversation for user {user_id}: {e}", exc_info=True)
            raise
    
    def get_conversation(self, conversation_id: int) -> Optional[ConversationPublic]:
        """Получить разговор по ID
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Разговор или None, если не найден
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if conversation:
                    return ConversationPublic.model_validate(conversation)
                return None
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}", exc_info=True)
            return None
    
    def get_conversations(self, user_id: int, agent_id: Optional[int] = None, offset: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Получить список разговоров пользователя с последним сообщением, отсортированных по времени последнего обновления."""
        try:
            logger.info(f"Getting conversations for user {user_id}, agent_id={agent_id}, offset={offset}, limit={limit}")
            with self.get_session() as session:
                # Получаем обычные разговоры пользователя
                query = select(Conversation).where(Conversation.user_id == user_id).where(Conversation.is_system_chat == False).where(Conversation.is_channel == False)  # noqa: E712
                if agent_id:
                    query = query.where(Conversation.agent_id == agent_id)
                
                conversations = session.exec(query).all()
                logger.info(f"Found {len(conversations)} conversations for user {user_id}")
                result = []
                
                for conv in conversations:
                    try:
                        conv_data = ConversationPublic.model_validate(conv).model_dump()
                        
                        # 📬 КРИТИЧНО: Явно добавляем unread_count, если его нет в сериализованных данных
                        # Это гарантирует, что поле всегда будет в ответе
                        if 'unread_count' not in conv_data or conv_data['unread_count'] is None:
                            conv_data['unread_count'] = getattr(conv, 'unread_count', 0) or 0
                        
                        # Получаем последнее сообщение (только неудаленные)
                        try:
                            last_message = session.exec(
                                select(Message)
                                .where(Message.conversation_id == conv.id)
                                .where(Message.is_deleted == False)
                                .order_by(Message.created_at.desc())
                            ).first()
                            
                            conv_data["last_message"] = last_message.content if last_message else None
                        except Exception as msg_error:
                            logger.warning(f"Error getting last message for conversation {conv.id}: {msg_error}", exc_info=True)
                            conv_data["last_message"] = None
                        
                        result.append(conv_data)
                    except Exception as conv_error:
                        logger.error(f"Error processing conversation {getattr(conv, 'id', 'unknown')}: {conv_error}", exc_info=True)
                        # Пропускаем проблемный разговор и продолжаем обработку остальных
                        continue
                
                # УДАЛЕНО - добавление каналов (channels были удалены)
                
                # Сортируем все по updated_at (время последнего сообщения)
                # Обрабатываем случай, когда updated_at или created_at могут быть None
                # Также обрабатываем случай, когда значение может быть datetime объектом
                def get_sort_key(item):
                    updated = item.get("updated_at")
                    created = item.get("created_at")
                    
                    # Если это datetime объект, конвертируем в строку
                    if isinstance(updated, datetime):
                        updated = updated.isoformat()
                    if isinstance(created, datetime):
                        created = created.isoformat()
                    
                    # Возвращаем строку для сортировки или дефолтное значение
                    return updated or created or "1970-01-01T00:00:00"
                
                result.sort(key=get_sort_key, reverse=True)
                
                # Применяем пагинацию
                return result[offset:offset + limit]
        except Exception as e:
            logger.error(f"Error in get_conversations for user {user_id}: {e}", exc_info=True)
            raise
    
    
    def save_message(self, conversation_id: int, content: str, is_from_user: bool, agent_id: Optional[int] = None, folder_service=None) -> MessagePublic:
        """Сохранить сообщение в разговоре
        
        Args:
            conversation_id: ID разговора
            content: Содержимое сообщения
            is_from_user: От пользователя ли сообщение
            agent_id: ID агента (если сообщение от агента)
            folder_service: Сервис папок (опционально)
            
        Returns:
            Сохраненное сообщение
            
        Raises:
            Exception: При ошибке сохранения сообщения
        """
        try:
            logger.info(f"💾 Saving message: conversation_id={conversation_id}, is_from_user={is_from_user}, agent_id={agent_id}, content_length={len(content)}")
            with self.get_session() as session:
                # Получаем разговор
                conversation = session.get(Conversation, conversation_id)
                
                # Создаем и добавляем сообщение
                message = Message(
                    conversation_id=conversation_id,
                    content=content,
                    is_from_user=is_from_user,
                    agent_id=agent_id
                )
                session.add(message)
                
                # Обновляем время последнего обновления разговора
                if conversation:
                    conversation.updated_at = datetime.utcnow()
                    if not getattr(conversation, "is_system_chat", False):
                        if is_from_user:
                            if conversation.unread_count:
                                conversation.unread_count = 0
                        else:
                            conversation.unread_count = (
                                (conversation.unread_count or 0) + 1
                            )
                    logger.debug(
                        f"Сохранено сообщение в чате {conversation_id}, обновлено время: {conversation.updated_at}"
                    )
                    
                    # Перемещаем чат на первое место во всех папках пользователя при отправке сообщения
                    if folder_service:
                        folder_service.move_chat_to_top_in_all_folders(conversation_id, conversation.user_id, session)
                        session.commit()  # Коммитим все изменения вместе
                    else:
                        logger.debug(f"folder_service не передан для чата {conversation_id}")
                        session.commit()
                else:
                    logger.warning(f"Разговор {conversation_id} не найден")
                    session.commit()
                
                session.refresh(message)
                logger.info(f"✅ Successfully saved message {message.id} in conversation {conversation_id}")
                return MessagePublic.model_validate(message)
        except Exception as e:
            logger.error(f"Error saving message in conversation {conversation_id}: {e}", exc_info=True)
            raise
    
    def get_conversation_messages(self, conversation_id: int, offset: int = 0, max_chars: int = 10000, before_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Получить сообщения из разговора с лимитом по символам
        
        Args:
            conversation_id: ID разговора
            offset: Смещение для пагинации (используется только если before_date не указан, для обратной совместимости)
            max_chars: Максимальное количество символов для загрузки (по умолчанию 10000)
            before_date: ISO строка даты - загружать сообщения, которые были созданы ДО этой даты (для правильной подгрузки старых)
            
        Returns:
            Список сообщений, сумма символов которых не превышает max_chars, отсортированных от старых к новым
        """
        try:
            with self.get_session() as session:
                from datetime import datetime
                
                # Если offset = 0 и before_date не указан, загружаем последние сообщения (от новых к старым)
                if offset == 0 and not before_date:
                    # Первая загрузка: получаем последние сообщения до лимита символов
                    # Сначала получаем все сообщения, отсортированные от новых к старым
                    all_messages = session.exec(
                        select(Message)
                        .where(Message.conversation_id == conversation_id)
                        .where(Message.is_deleted == False)
                        .order_by(Message.created_at.desc())  # От новых к старым
                    ).all()
                    
                    # Накапливаем сообщения пока не превысим лимит символов
                    result = []
                    total_chars = 0
                    for message in all_messages:
                        message_chars = len(message.content or "")
                        if total_chars + message_chars > max_chars:
                            break
                        total_chars += message_chars
                        result.append(message)
                    
                    # Разворачиваем список, чтобы вернуть от старых к новым (для UI)
                    result = list(reversed(result))
                else:
                    # Подгрузка старых сообщений: получаем сообщения старше уже загруженных
                    # Используем before_date для правильной последовательности загрузки
                    if before_date:
                        try:
                            # Парсим дату (поддерживаем разные форматы)
                            if 'T' in before_date:
                                before_datetime = datetime.fromisoformat(before_date.replace('Z', '+00:00'))
                            else:
                                before_datetime = datetime.fromisoformat(before_date)
                            
                            # Загружаем сообщения ДО указанной даты, отсортированные от новых к старым
                            # (чтобы взять последние сообщения до этой даты)
                            all_messages = session.exec(
                                select(Message)
                                .where(Message.conversation_id == conversation_id)
                                .where(Message.is_deleted == False)
                                .where(Message.created_at < before_datetime)
                                .order_by(Message.created_at.desc())  # От новых к старым
                            ).all()
                        except Exception as e:
                            logger.warning(f"Invalid before_date format: {before_date}, error: {e}, using offset fallback")
                            # Fallback на offset если дата невалидна
                            all_messages = session.exec(
                                select(Message)
                                .where(Message.conversation_id == conversation_id)
                                .where(Message.is_deleted == False)
                                .order_by(Message.created_at.asc())
                                .offset(offset)
                            ).all()
                    else:
                        # Fallback: используем offset если before_date не указан
                        # Загружаем сообщения от старых к новым, начиная с позиции offset от начала
                        all_messages = session.exec(
                            select(Message)
                            .where(Message.conversation_id == conversation_id)
                            .where(Message.is_deleted == False)
                            .order_by(Message.created_at.asc())
                            .offset(offset)
                        ).all()
                    
                    # Накапливаем сообщения пока не превысим лимит символов
                    result = []
                    total_chars = 0
                    for message in all_messages:
                        message_chars = len(message.content or "")
                        if total_chars + message_chars > max_chars:
                            break
                        total_chars += message_chars
                        result.append(message)
                    
                    # Если использовали before_date, разворачиваем список (т.к. загружали от новых к старым)
                    # чтобы вернуть от старых к новым для правильного порядка
                    if before_date:
                        result = list(reversed(result))
                    # Иначе оставляем как есть (уже отсортированы от старых к новым)
                
                # Форматируем сообщения
                formatted_result = []
                for message in result:
                    message_data = self._build_message_dict(message, session=session)
                    
                    # Если сообщение от агента, получаем его имя
                    if message.agent_id:
                        message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                    
                    formatted_result.append(message_data)
                
                total_chars = sum(len(msg.get("content", "") or "") for msg in formatted_result)
                logger.debug(
                    f"Loaded {len(formatted_result)} messages for conversation {conversation_id} "
                    f"(offset={offset}, before_date={before_date}, total_chars={total_chars}, max_chars={max_chars})"
                )
                
                return formatted_result
        except Exception as e:
            logger.error(f"Error getting messages for conversation {conversation_id}: {e}", exc_info=True)
            return []
    
    def delete_conversation(self, conversation_id: int) -> bool:
        """Удалить разговор и все его сообщения
        
        Args:
            conversation_id: ID разговора для удаления
            
        Returns:
            True, если разговор успешно удален, False если не найден
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    logger.warning(f"Conversation {conversation_id} not found for deletion")
                    return False
                
                # Удаляем все файлы, связанные с разговором
                try:
                    deleted_files_count = self.file_storage_service.delete_files_by_conversation(session, conversation_id)
                    if deleted_files_count > 0:
                        logger.info(f"Deleted {deleted_files_count} file(s) associated with conversation {conversation_id}")
                except Exception as e:
                    logger.error(f"Error deleting files for conversation {conversation_id}: {e}", exc_info=True)
                    # Продолжаем удаление разговора даже если удаление файлов не удалось
                
                # Удаляем все сообщения разговора
                messages = session.exec(select(Message).where(Message.conversation_id == conversation_id)).all()
                for message in messages:
                    session.delete(message)
                
                # Удаляем разговор
                session.delete(conversation)
                session.commit()
                
                logger.info(f"Successfully deleted conversation {conversation_id} with {len(messages)} messages")
                return True
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def pin_message(self, conversation_id: int, message_id: int) -> bool:
        """Закрепить сообщение в разговоре"""
        with self.get_session() as session:
            message = session.get(Message, message_id)
            
            if not message:
                return False
            
            # Определяем тип разговора по полям сообщения
            if message.conversation_id is not None:
                # Обычный разговор
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    return False
                
                # Проверяем, что сообщение принадлежит этому разговору
                if message.conversation_id != conversation_id:
                    return False
                
                # Проверяем, не закреплено ли уже это сообщение
                if message.is_pinned:
                    return True  # Сообщение уже закреплено
                
                # Закрепляем новое сообщение
                message.is_pinned = True
                conversation.updated_at = datetime.utcnow()
                
            elif message.multi_agent_conversation_id is not None:
                # Групповой разговор
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return False
                
                # Проверяем, что сообщение принадлежит этому групповому разговору
                if message.multi_agent_conversation_id != conversation_id:
                    return False
                
                # Проверяем, не закреплено ли уже это сообщение
                if message.is_pinned:
                    return True  # Сообщение уже закреплено
                
                # Закрепляем новое сообщение
                message.is_pinned = True
                conversation.updated_at = datetime.utcnow()
                
            else:
                return False
            
            session.commit()
            return True
    
    def unpin_message(self, conversation_id: int) -> bool:
        """Открепить сообщение в разговоре"""
        with self.get_session() as session:
            # Сначала пытаемся найти обычный разговор
            conversation = session.get(Conversation, conversation_id)
            if conversation:
                # Находим текущее закрепленное сообщение в обычном разговоре и открепляем
                pinned_message = session.exec(
                    select(Message)
                    .where(Message.conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                ).first()
                if pinned_message:
                    pinned_message.is_pinned = False
                    conversation.updated_at = datetime.utcnow()
                    session.commit()
                    return True
                return False
            
            # Если не найден обычный разговор, пробуем групповой
            multi_conversation = session.get(MultiAgentConversation, conversation_id)
            if multi_conversation:
                # Находим текущее закрепленное сообщение в групповом разговоре и открепляем
                pinned_message = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                ).first()
                if pinned_message:
                    pinned_message.is_pinned = False
                    multi_conversation.updated_at = datetime.utcnow()
                    session.commit()
                    return True
                return False
            
            return False
    
    def delete_message(self, message_id: int) -> bool:
        """Удалить сообщение (мягкое удаление)"""
        try:
            with self.get_session() as session:
                message = session.get(Message, message_id)
                
                if not message:
                    logger.warning(f"Message {message_id} not found")
                    return False
                
                logger.debug(f"Deleting message {message_id} - conversation_id: {message.conversation_id}, multi_agent_conversation_id: {message.multi_agent_conversation_id}")
                
                # Удаляем файлы, связанные с сообщением
                try:
                    deleted_files_count = self.file_storage_service.delete_files_by_message(session, message_id)
                    if deleted_files_count > 0:
                        logger.info(f"Deleted {deleted_files_count} file(s) associated with message {message_id}")
                except Exception as e:
                    logger.error(f"Error deleting files for message {message_id}: {e}", exc_info=True)
                    # Продолжаем удаление сообщения даже если удаление файлов не удалось
                
                # Мягкое удаление
                message.is_deleted = True
                
                # Если это было закрепленное сообщение, снимаем флаг и обновляем разговор
                if message.is_pinned:
                    message.is_pinned = False
                    
                    # Обновляем время для обычного разговора
                    if message.conversation_id:
                        conversation = session.get(Conversation, message.conversation_id)
                        if conversation:
                            conversation.updated_at = datetime.utcnow()
                            logger.debug(f"Updated regular conversation {message.conversation_id}")
                    
                    # Обновляем время для группового разговора
                    if message.multi_agent_conversation_id:
                        multi_conversation = session.get(MultiAgentConversation, message.multi_agent_conversation_id)
                        if multi_conversation:
                            multi_conversation.updated_at = datetime.utcnow()
                            logger.debug(f"Updated group conversation {message.multi_agent_conversation_id}")
                
                session.commit()
                logger.info(f"Successfully deleted message {message_id}")
                return True
        except Exception as e:
            logger.error(f"Error deleting message {message_id}: {e}", exc_info=True)
            return False
    
    def get_pinned_message(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        """Получить закрепленное сообщение разговора"""
        with self.get_session() as session:
            # Сначала пытаемся найти обычный разговор
            conversation = session.get(Conversation, conversation_id)
            if conversation:
                # Находим текущее закрепленное сообщение в обычном разговоре
                message = session.exec(
                    select(Message)
                    .where(Message.conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                ).first()
                if not message:
                    return None
                
                message_data = self._build_message_dict(message, session=session)
                
                # Если сообщение от агента, получаем его имя
                if message.agent_id:
                    message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                
                return message_data
            
            # Если не найден обычный разговор, пробуем групповой
            multi_conversation = session.get(MultiAgentConversation, conversation_id)
            if multi_conversation:
                # Находим текущее закрепленное сообщение в групповом разговоре
                message = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                ).first()
                if not message:
                    return None
                
                message_data = self._build_message_dict(message, session=session)
                
                # Если сообщение от агента, получаем его имя
                if message.agent_id:
                    message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                
                return message_data
            
            return None
    
    def get_pinned_messages(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Получить все закрепленные сообщения разговора"""
        with self.get_session() as session:
            # Сначала пытаемся найти обычный разговор
            conversation = session.get(Conversation, conversation_id)
            if conversation:
                # Находим все закрепленные сообщения в обычном разговоре
                messages = session.exec(
                    select(Message)
                    .where(Message.conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                    .order_by(Message.created_at.desc())
                ).all()
                
                result = []
                for message in messages:
                    message_data = self._build_message_dict(message, include_pinned=False, session=session)
                    
                    # Если сообщение от агента, получаем его имя
                    if message.agent_id:
                        message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                    
                    result.append(message_data)
                
                return result
            
            # Если не найден обычный разговор, пытаемся найти групповой
            group_conversation = session.get(MultiAgentConversation, conversation_id)
            if group_conversation:
                # Находим все закрепленные сообщения в групповом разговоре
                messages = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                    .where(Message.is_deleted == False)
                    .order_by(Message.created_at.desc())
                ).all()
                
                result = []
                for message in messages:
                    message_data = self._build_message_dict(message, include_pinned=False, session=session)
                    
                    # Если сообщение от агента, получаем его имя
                    if message.agent_id:
                        message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                    
                    result.append(message_data)
                
                return result
            
            return []
    
    def unpin_specific_message(self, conversation_id: int, message_id: int) -> bool:
        """Открепить конкретное сообщение в разговоре"""
        with self.get_session() as session:
            # Получаем сообщение
            message = session.get(Message, message_id)
            if not message:
                return False
            
            # Проверяем, что сообщение принадлежит этому разговору
            if message.conversation_id != conversation_id and message.multi_agent_conversation_id != conversation_id:
                return False
            
            # Проверяем, что сообщение закреплено
            if not message.is_pinned:
                return False
            
            # Открепляем сообщение
            message.is_pinned = False
            
            # Обновляем время изменения разговора
            if message.conversation_id:
                conversation = session.get(Conversation, message.conversation_id)
                if conversation:
                    conversation.updated_at = datetime.utcnow()
            elif message.multi_agent_conversation_id:
                conversation = session.get(MultiAgentConversation, message.multi_agent_conversation_id)
                if conversation:
                    conversation.updated_at = datetime.utcnow()
            
            session.commit()
            return True
    
    def get_user_rules(self, conversation_id: int) -> List[str]:
        """Получить правила пользователя для разговора
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Список правил пользователя
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    logger.debug(f"Беседа {conversation_id} не найдена при получении правил")
                    return []
                
                rules = conversation.get_user_rules()
                logger.debug(f"📋 Загружено {len(rules)} правил для беседы {conversation_id}: {rules}")
                return rules
        except Exception as e:
            logger.error(f"❌ Ошибка при получении правил для беседы {conversation_id}: {e}", exc_info=True)
            return []
    
    def set_user_rules(self, conversation_id: int, rules: List[str]) -> bool:
        """Установить правила пользователя для разговора
        
        Args:
            conversation_id: ID разговора
            rules: Список правил пользователя
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    logger.warning(f"Беседа {conversation_id} не найдена при сохранении правил")
                    return False
                
                # Устанавливаем правила (объект уже отслеживается сессией через session.get())
                old_rules = conversation.get_user_rules()
                conversation.set_user_rules(rules)
                conversation.updated_at = datetime.utcnow()
                
                # Сохраняем изменения в БД
                session.commit()
                session.refresh(conversation)  # Обновляем объект из БД
                
                # Проверяем, что правила сохранились
                saved_rules = conversation.get_user_rules()
                logger.info(f"✅ Правила сохранены для беседы {conversation_id}: {len(old_rules)} -> {len(saved_rules)} правил")
                logger.debug(f"📝 Старые правила: {old_rules}")
                logger.debug(f"📝 Новые правила: {saved_rules}")
                
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении правил для беседы {conversation_id}: {e}", exc_info=True)
            return False
    
    def set_selected_model(self, conversation_id: int, model: str) -> bool:
        """Установить выбранную модель для разговора
        
        Args:
            conversation_id: ID разговора
            model: Название модели
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    logger.warning(f"Беседа {conversation_id} не найдена при сохранении модели")
                    return False
                
                old_model = conversation.selected_model
                conversation.selected_model = model
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(conversation)
                
                logger.info(f"✅ Модель сохранена для беседы {conversation_id}: {old_model} -> {model}")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении модели для беседы {conversation_id}: {e}", exc_info=True)
            return False
    
    def get_selected_model(self, conversation_id: int) -> Optional[str]:
        """Получить выбранную модель для разговора
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Название модели или None, если не установлена
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    return None
                return conversation.selected_model
        except Exception as e:
            logger.error(f"❌ Ошибка при получении модели для беседы {conversation_id}: {e}", exc_info=True)
            return None
    
    def set_title(self, conversation_id: int, title: str) -> bool:
        """Установить название для разговора
        
        Args:
            conversation_id: ID разговора
            title: Новое название
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            with self.get_session() as session:
                conversation = session.get(Conversation, conversation_id)
                if not conversation:
                    logger.warning(f"Беседа {conversation_id} не найдена при сохранении названия")
                    return False
                
                old_title = conversation.title
                conversation.title = title.strip() if title else None
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(conversation)
                
                logger.info(f"✅ Название сохранено для беседы {conversation_id}: '{old_title}' -> '{conversation.title}'")
                return True
        except Exception as e:
            logger.error(f"❌ Ошибка при сохранении названия для беседы {conversation_id}: {e}", exc_info=True)
            return False
    
    def clear_conversation_messages(self, conversation_id: int) -> bool:
        """Очистить все сообщения из разговора (мягкое удаление)"""
        try:
            with self.get_session() as session:
                # Проверяем, существует ли обычный разговор
                conversation = session.get(Conversation, conversation_id)
                if conversation:
                    logger.debug(f"Clearing messages from regular conversation: {conversation_id}")
                    # Получаем все сообщения обычного разговора
                    messages = session.exec(
                        select(Message)
                        .where(Message.conversation_id == conversation_id)
                        .where(Message.is_deleted == False)
                    ).all()
                    
                    logger.debug(f"Found {len(messages)} messages to clear")
                    # Мягко удаляем все сообщения
                    for message in messages:
                        message.is_deleted = True
                        message.is_pinned = False  # Снимаем закрепление
                    
                    # Обновляем время последнего обновления разговора
                    conversation.updated_at = datetime.utcnow()
                    conversation.unread_count = 0
                    
                    session.commit()
                    logger.info(f"Successfully cleared {len(messages)} messages from regular conversation {conversation_id}")
                    return True
                
                # Если не найден обычный разговор, проверяем групповой
                multi_conversation = session.get(MultiAgentConversation, conversation_id)
                if multi_conversation:
                    logger.debug(f"Clearing messages from group conversation: {conversation_id}")
                    # Получаем все сообщения группового разговора
                    messages = session.exec(
                        select(Message)
                        .where(Message.multi_agent_conversation_id == conversation_id)
                        .where(Message.is_deleted == False)
                    ).all()
                    
                    logger.debug(f"Found {len(messages)} messages to clear")
                    # Мягко удаляем все сообщения
                    for message in messages:
                        message.is_deleted = True
                        message.is_pinned = False  # Снимаем закрепление
                    
                    # Обновляем время последнего обновления разговора
                    multi_conversation.updated_at = datetime.utcnow()
                    multi_conversation.unread_count = 0
                    
                    session.commit()
                    logger.info(f"Successfully cleared {len(messages)} messages from group conversation {conversation_id}")
                    return True
                
                logger.warning(f"No conversation found with ID: {conversation_id}")
                return False
        except Exception as e:
            logger.error(f"Error clearing conversation messages {conversation_id}: {e}", exc_info=True)
            return False
    
    def _get_agent_name(self, session: Session, agent_id: int, message_id: Optional[int] = None) -> str:
        """Получить имя агента по ID
        
        Args:
            session: Сессия базы данных
            agent_id: ID агента
            message_id: ID сообщения (для логирования)
            
        Returns:
            Имя агента или "Агент" по умолчанию
        """
        try:
            agent = session.get(Agent, agent_id)
            if agent:
                return agent.name
            return "Агент"
        except Exception as e:
            if message_id:
                logger.error(f"Error getting agent name for message {message_id}: {e}", exc_info=True)
            else:
                logger.error(f"Error getting agent name for agent {agent_id}: {e}", exc_info=True)
            return "Агент"
    
    def _build_message_dict(self, message: Message, include_pinned: bool = True, session: Optional[Session] = None) -> Dict[str, Any]:
        """Построить словарь данных сообщения
        
        Args:
            message: Сообщение
            include_pinned: Включить ли поле is_pinned
            session: Сессия базы данных для загрузки file_attachments (опционально)
            
        Returns:
            Словарь с данными сообщения
        """
        # Загружаем file_attachments если сессия предоставлена
        file_attachments = []
        if session:
            from models.file_attachment import FileAttachment
            from sqlmodel import select
            # Всегда загружаем file_attachments из базы данных для этого сообщения
            attachments = session.exec(
                select(FileAttachment).where(FileAttachment.message_id == message.id)
            ).all()
            file_attachments = [
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
        
        message_data = {
            "id": message.id,
            "content": message.content,
            "is_from_user": message.is_from_user,
            "created_at": message.created_at.isoformat() if message.created_at else None,
            "agent_id": message.agent_id,
            "agent_name": None,
            "original_chat_name": message.original_chat_name,
            "original_agent_name": message.original_agent_name,
            "file_attachments": file_attachments
        }
        
        if include_pinned:
            message_data["is_pinned"] = message.is_pinned
        
        return message_data
    
    def _format_conversation_dict(self, conversation: Conversation) -> Dict[str, Any]:
        """Форматировать словарь данных разговора
        
        Args:
            conversation: Разговор
            
        Returns:
            Словарь с данными разговора
        """
        return {
            "id": conversation.id,
            "title": conversation.title,
            "agent_id": conversation.agent_id,
            "user_id": conversation.user_id,
            "is_system_chat": getattr(conversation, 'is_system_chat', True),
            "is_channel": getattr(conversation, "is_channel", False),
            "channel_owner_id": getattr(conversation, "channel_owner_id", None),
            "channel_description": getattr(conversation, "channel_description", None),
            "is_listed": getattr(conversation, "is_listed", True),
            "frozen_at": conversation.frozen_at.isoformat() + 'Z' if getattr(conversation, "frozen_at", None) else None,
            "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
            "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
            "unread_count": conversation.unread_count or 0,
            "selected_model": getattr(conversation, "selected_model", None),  # Выбранная модель для чата
        }