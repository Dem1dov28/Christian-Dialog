from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlmodel import Session, select
import logging

from models.message import Message, MultiAgentChatMessage
from models.agent import Agent
from services.base_service import BaseService
from services.multi_agent_conversation_service import MultiAgentConversationService
from services.agent_dialogue_service import AgentDialogueService
from services.agent_selector_service import AgentSelectorService

logger = logging.getLogger(__name__)


class MultiAgentChatService(BaseService):
    """Фасад для работы с многопользовательскими чатами"""
    
    def __init__(self, agent_service):
        super().__init__()
        self.agent_service = agent_service
        self.conversation_service = MultiAgentConversationService()
        self.agent_selector = AgentSelectorService()
        self.dialogue_service = AgentDialogueService(agent_service, self.agent_selector)
    
    def create_conversation(self, conversation_data, user_id: int) -> Dict[str, Any]:
        """Создать новый многопользовательский чат"""
        # ВАЖНО: передаём conversation_data, agent_service и user_id в правильном порядке
        return self.conversation_service.create_conversation(conversation_data, self.agent_service, user_id)
    
    def add_agent_to_conversation(self, conversation_id: int, agent_id: int) -> bool:
        """Добавить агента в существующий разговор
        
        Args:
            conversation_id: ID разговора
            agent_id: ID агента
            
        Returns:
            True, если агент успешно добавлен, False в противном случае
        """
        try:
            return self.conversation_service.add_agent_to_conversation(conversation_id, agent_id, self.agent_service)
        except Exception as e:
            logger.error(f"Error adding agent {agent_id} to conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def remove_agent_from_conversation(self, conversation_id: int, agent_id: int) -> bool:
        """Удалить агента из разговора
        
        Args:
            conversation_id: ID разговора
            agent_id: ID агента
            
        Returns:
            True, если агент успешно удален, False в противном случае
        """
        try:
            return self.conversation_service.remove_agent_from_conversation(conversation_id, agent_id)
        except Exception as e:
            logger.error(f"Error removing agent {agent_id} from conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def get_conversation_agents(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Получить список агентов в разговоре"""
        return self.conversation_service.get_conversation_agents(conversation_id)
    
    def update_conversation_title(self, conversation_id: int, title: str) -> bool:
        """Обновить название группового чата
        
        Args:
            conversation_id: ID разговора
            title: Новое название
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            return self.conversation_service.update_conversation_title(conversation_id, title)
        except Exception as e:
            logger.error(f"Error updating title for conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def update_conversation_avatar(self, conversation_id: int, group_avatar: str) -> bool:
        """Обновить иконку аватара группового чата
        
        Args:
            conversation_id: ID разговора
            group_avatar: Название иконки аватара
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            return self.conversation_service.update_conversation_avatar(conversation_id, group_avatar)
        except Exception as e:
            logger.error(f"Error updating avatar for conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def update_conversation_avatar_url(self, conversation_id: int, group_avatar: str, group_avatar_url: Optional[str]) -> bool:
        """Обновить аватар группового чата (иконку и URL)
        
        Args:
            conversation_id: ID разговора
            group_avatar: Название иконки аватара
            group_avatar_url: URL загруженного изображения (может быть None)
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            return self.conversation_service.update_conversation_avatar_url(conversation_id, group_avatar, group_avatar_url)
        except Exception as e:
            logger.error(f"Error updating avatar URL for conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    async def send_message(self, message_data: MultiAgentChatMessage) -> Dict[str, Any]:
        """Отправить сообщение в многопользовательский чат
        
        Args:
            message_data: Данные сообщения
            
        Returns:
            Словарь с данными отправленного сообщения
            
        Raises:
            ValueError: Если разговор не найден, нет активных агентов или сообщение пустое
        """
        try:
            with self.get_session() as session:
                # Преобразуем conversation_id в int
                conversation_id = int(message_data.conversation_id)
            
                # Проверяем, существует ли разговор
                # ВАЖНО: передаем user_id для проверки прав доступа будет проверен на уровне API
                conversation = self.conversation_service.get_conversation(conversation_id)
                if not conversation:
                    raise ValueError("Conversation not found")
                
                # Проверяем тип чата - MultiAgentChatService должен работать только с agents_only
                conversation_type = conversation.get("conversation_type") or "agents_only"
                if conversation_type != "agents_only":
                    raise ValueError(
                        f"This service is for multi-agent chats only. "
                        f"Use MultiAgentToolsService for tools-only chats. "
                        f"Current type: {conversation_type}"
                    )
                
                # Получаем активных агентов в разговоре
                agents = self.get_conversation_agents(conversation_id)
                if not agents:
                    raise ValueError("No active agents in conversation")
                
                # Валидация сообщения
                if not message_data.message or not message_data.message.strip():
                    raise ValueError("Message cannot be empty")
                
                # Сохраняем сообщение пользователя
                user_message = Message(
                    multi_agent_conversation_id=conversation_id,
                    content=message_data.message.strip(),
                    is_from_user=True
                )
                session.add(user_message)
                
                # Обновляем время последнего обновления разговора
                from models.multi_agent_conversation import MultiAgentConversation
                multi_conversation = session.get(MultiAgentConversation, conversation_id)
                if multi_conversation:
                    multi_conversation.updated_at = datetime.utcnow()
                    multi_conversation.unread_count = 0
                    logger.debug(f"Saved message in multi-agent chat {conversation_id}, updated time: {multi_conversation.updated_at}")
                    
                    # Перемещаем чат на первое место во всех папках пользователя при отправке сообщения
                    from services.folder_service import FolderService
                    folder_service = FolderService()
                    folder_service.move_chat_to_top_in_all_folders(conversation_id, multi_conversation.user_id, session)
                    session.commit()  # Коммитим все изменения вместе
                else:
                    logger.warning(f"Multi-agent conversation {conversation_id} not found")
                    session.commit()
                
                # Если сообщение от конкретного агента, сохраняем его
                if message_data.sender_agent_id:
                    # Проверяем, что агент активен в разговоре
                    if not any(agent["id"] == message_data.sender_agent_id for agent in agents):
                        raise ValueError("Agent is not active in this conversation")
                    
                    agent_message = Message(
                        multi_agent_conversation_id=conversation_id,
                        content=message_data.message.strip(),
                        is_from_user=False,
                        agent_id=message_data.sender_agent_id
                    )
                    session.add(agent_message)
                    
                    # Обновляем время последнего обновления разговора
                    if multi_conversation:
                        multi_conversation.updated_at = datetime.utcnow()
                        multi_conversation.unread_count = (multi_conversation.unread_count or 0) + 1
                        logger.debug(f"Saved agent message in multi-agent chat {conversation_id}, updated time: {multi_conversation.updated_at}")
                        
                        # Перемещаем чат на первое место во всех папках пользователя при отправке сообщения от агента
                        from services.folder_service import FolderService
                        folder_service = FolderService()
                        folder_service.move_chat_to_top_in_all_folders(conversation_id, multi_conversation.user_id, session)
                        session.commit()  # Коммитим все изменения вместе
                    else:
                        session.commit()
                    session.refresh(agent_message)
                    
                    return {
                        "conversation_id": conversation_id,
                        "message": message_data.message.strip(),
                        "sender_agent_id": message_data.sender_agent_id,
                        "message_id": agent_message.id
                    }
                
                # Если сообщение от пользователя, запускаем общение агентов
                # Получаем язык из message_data (если указан), иначе определяем автоматически
                language = getattr(message_data, 'language', None)
                if not language:
                    # Автоматически определяем язык из сообщения пользователя
                    from core.language_detector import LanguageDetector
                    try:
                        language = LanguageDetector.detect(message_data.message.strip())
                        if language:
                            logger.info(
                                f"🈯 Автоматически определён язык сообщения в мульти-агентном чате {conversation_id}: {language}"
                            )
                    except Exception as e:
                        logger.debug(f"Не удалось определить язык сообщения: {e}")
                        language = None
                
                return await self.dialogue_service.trigger_agent_conversation(
                    conversation_id, 
                    message_data.message.strip(), 
                    agents,
                    language=language  # Передаем язык для ответа агентов
                )
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error sending message to multi-agent chat {message_data.conversation_id}: {e}", exc_info=True)
            raise
    
    async def continue_dialogue(self, conversation_id: int, language: Optional[str] = None, is_chat_active: bool = False) -> Dict[str, Any]:
        """Продолжить диалог между агентами без участия пользователя
        
        Args:
            conversation_id: ID разговора
            language: Язык для ответа
            is_chat_active: Если True, чат активен и счетчик не увеличивается
        """
        # Получаем активных агентов в разговоре
        agents = self.get_conversation_agents(conversation_id)
        if len(agents) < 2:
            raise ValueError("Need at least 2 agents to continue dialogue")
        
        return await self.dialogue_service.continue_dialogue(conversation_id, agents, language=language, is_chat_active=is_chat_active)
    
    def get_conversation_messages(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Получить сообщения из многопользовательского разговора
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Список сообщений разговора
        """
        try:
            with self.get_session() as session:
                messages = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_deleted == False)  # ИСКЛЮЧАЕМ удаленные сообщения
                    .order_by(Message.created_at)
                ).all()
                
                result = []
                for message in messages:
                    message_data = {
                        "id": message.id,
                        "content": message.content,
                        "is_from_user": message.is_from_user,
                        "created_at": message.created_at.isoformat() if message.created_at else None,
                        "agent_id": message.agent_id,
                        "agent_name": None
                    }
                    
                    # Если сообщение от агента, получаем его имя
                    if message.agent_id:
                        message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                    
                    result.append(message_data)
                
                return result
        except Exception as e:
            logger.error(f"Error getting messages for multi-agent conversation {conversation_id}: {e}", exc_info=True)
            return []
    
    def get_conversation(self, conversation_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Получить конкретный многопользовательский разговор
        
        Args:
            conversation_id: ID разговора
            user_id: ID пользователя для проверки прав доступа (опционально)
        """
        return self.conversation_service.get_conversation(conversation_id, user_id)
    
    def get_conversations(self, user_id: int) -> List[Dict[str, Any]]:
        """Получить список многопользовательских разговоров пользователя"""
        return self.conversation_service.get_conversations(user_id)
    
    def delete_conversation(self, conversation_id: int) -> bool:
        """Удалить многопользовательский разговор"""
        return self.conversation_service.delete_conversation(conversation_id)
    
    def pin_message(self, conversation_id: int, message_id: int) -> bool:
        """Закрепить сообщение в многопользовательском чате
        
        Args:
            conversation_id: ID разговора
            message_id: ID сообщения
            
        Returns:
            True, если сообщение успешно закреплено, False в противном случае
        """
        try:
            with self.get_session() as session:
                message = session.get(Message, message_id)
                
                if not message:
                    return False
                
                # Проверяем, что сообщение принадлежит групповому разговору
                if message.multi_agent_conversation_id != conversation_id:
                    return False
                
                # Проверяем, что разговор существует
                from models.multi_agent_conversation import MultiAgentConversation
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return False
                
                # Проверяем, не закреплено ли уже это сообщение
                if message.is_pinned:
                    return True  # Сообщение уже закреплено
                
                # Закрепляем новое сообщение
                message.is_pinned = True
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                logger.debug(f"Pinned message {message_id} in multi-agent conversation {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"Error pinning message {message_id} in conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def unpin_message(self, conversation_id: int) -> bool:
        """Открепить сообщение в многопользовательском чате
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            True, если сообщение успешно откреплено, False в противном случае
        """
        try:
            with self.get_session() as session:
                # Проверяем, что разговор существует
                from models.multi_agent_conversation import MultiAgentConversation
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return False
                
                # Находим текущее закрепленное сообщение в групповом разговоре и открепляем
                pinned_message = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                ).first()
                if not pinned_message:
                    return False
                
                pinned_message.is_pinned = False
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                logger.debug(f"Unpinned message in multi-agent conversation {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"Error unpinning message in conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def get_pinned_message(self, conversation_id: int) -> Optional[Dict[str, Any]]:
        """Получить закрепленное сообщение многопользовательского чата
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Словарь с данными закрепленного сообщения или None, если сообщение не найдено
        """
        try:
            with self.get_session() as session:
                # Проверяем, что разговор существует
                from models.multi_agent_conversation import MultiAgentConversation
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return None
                
                # Находим текущее закрепленное сообщение в групповом разговоре
                message = session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .where(Message.is_pinned == True)
                ).first()
                if not message or message.is_deleted:
                    return None
                
                message_data = {
                    "id": message.id,
                    "content": message.content,
                    "is_from_user": message.is_from_user,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                    "agent_id": message.agent_id,
                    "agent_name": None
                }
                
                # Если сообщение от агента, получаем его имя
                if message.agent_id:
                    message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                
                return message_data
        except Exception as e:
            logger.error(f"Error getting pinned message for conversation {conversation_id}: {e}", exc_info=True)
            return None
    
    def get_pinned_messages(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Получить все закрепленные сообщения многопользовательского чата
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Список закрепленных сообщений
        """
        try:
            with self.get_session() as session:
                # Проверяем, что разговор существует
                from models.multi_agent_conversation import MultiAgentConversation
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return []
                
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
                    message_data = {
                        "id": message.id,
                        "content": message.content,
                        "is_from_user": message.is_from_user,
                        "created_at": message.created_at.isoformat() if message.created_at else None,
                        "agent_id": message.agent_id,
                        "agent_name": None
                    }
                    
                    # Если сообщение от агента, получаем его имя
                    if message.agent_id:
                        message_data["agent_name"] = self._get_agent_name(session, message.agent_id, message.id)
                        
                    result.append(message_data)
                
                return result
        except Exception as e:
            logger.error(f"Error getting pinned messages for conversation {conversation_id}: {e}", exc_info=True)
            return []
    
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
    
    def unpin_specific_message(self, conversation_id: int, message_id: int) -> bool:
        """Открепить конкретное сообщение в групповом чате
        
        Args:
            conversation_id: ID разговора
            message_id: ID сообщения
            
        Returns:
            True, если сообщение успешно откреплено, False в противном случае
        """
        try:
            with self.get_session() as session:
                # Получаем сообщение
                message = session.get(Message, message_id)
                if not message:
                    return False
                
                # Проверяем, что сообщение принадлежит этому групповому разговору
                if message.multi_agent_conversation_id != conversation_id:
                    return False
                
                # Проверяем, что сообщение закреплено
                if not message.is_pinned:
                    return False
                
                # Открепляем сообщение
                message.is_pinned = False
                
                # Обновляем время изменения разговора
                from models.multi_agent_conversation import MultiAgentConversation
                conversation = session.get(MultiAgentConversation, conversation_id)
                if conversation:
                    conversation.updated_at = datetime.utcnow()
                
                session.commit()
                logger.debug(f"Unpinned specific message {message_id} in conversation {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"Error unpinning specific message {message_id} in conversation {conversation_id}: {e}", exc_info=True)
            return False