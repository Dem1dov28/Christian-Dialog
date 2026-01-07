from typing import Dict, Any, List, Optional
from sqlmodel import Session, select, col
from datetime import datetime
import logging

from models.multi_agent_conversation import (
    MultiAgentConversation, 
    MultiAgentConversationCreate, 
    ConversationAgent
)
from models.agent import Agent
from services.base_service import BaseService
from services.file_storage_service import FileStorageService

logger = logging.getLogger(__name__)


class MultiAgentConversationService(BaseService):
    """Сервис для работы с многопользовательскими разговорами"""
    
    def __init__(self):
        super().__init__()
        self.file_storage_service = FileStorageService()
    
    def create_conversation(self, conversation_data: MultiAgentConversationCreate, agent_service, user_id: int) -> Dict[str, Any]:
        """Создать новый многопользовательский чат
        
        Args:
            conversation_data: Данные для создания разговора
            agent_service: Сервис агентов
            user_id: ID пользователя
            
        Returns:
            Словарь с данными созданного разговора
            
        Raises:
            ValueError: Если агент не найден или не активен
        """
        try:
            logger.debug(f"Creating multi-agent conversation for user {user_id}")
            with self.get_session() as session:
                # Определяем тип чата (только agents_only для персонажей)
                conversation_type = conversation_data.conversation_type or "agents_only"
                
                # Валидация типа чата
                if conversation_type != "agents_only":
                    raise ValueError(f"Invalid conversation_type: {conversation_type}. Only 'agents_only' is supported.")
                
                # Проверяем, что переданы agent_ids
                agent_ids_list = conversation_data.agent_ids or []
                if not agent_ids_list:
                    raise ValueError("agent_ids required for conversation type")
                
                # Проверяем, что все агенты существуют и активны
                if conversation_type == "agents_only":
                    if not agent_service:
                        raise ValueError("agent_service required for agents_only conversation type")
                    for agent_id in agent_ids_list:
                        agent = session.get(Agent, agent_id)
                        if not agent:
                            raise ValueError(f"Agent with ID {agent_id} not found")
                        if not agent_service.is_agent_active(agent_id):
                            raise ValueError(f"Agent with ID {agent_id} is not active")
                
                # Валидируем аватар группового чата
                allowed_group_avatars = {
                    "group",
                    "groups",
                    "group_add",
                    "group_work",
                    "diversity",
                    "people_alt",
                    "emoji_people",
                    "connect",
                    "interpreter",
                    "chat",
                    "comedy",
                    "star",
                    "fire",
                    "diamond",
                    "star_border",
                    "fa_people_group",
                    "team_fill",
                }
                requested_avatar = (conversation_data.group_avatar or "group").strip().lower()
                group_avatar = requested_avatar if requested_avatar in allowed_group_avatars else "group"
                if requested_avatar not in allowed_group_avatars:
                    logger.debug(
                        "Group avatar '%s' не входит в список разрешенных, используем значение по умолчанию",
                        conversation_data.group_avatar,
                    )

                # Создаем разговор
                agent_ids_list = conversation_data.agent_ids or []
                conversation = MultiAgentConversation(
                    title=conversation_data.title or (f"Чат с {len(agent_ids_list)} агентами" if agent_ids_list else "Чат с инструментами"),
                    description=conversation_data.description,
                    user_id=user_id,
                    group_avatar=group_avatar,
                    group_avatar_url=conversation_data.group_avatar_url,
                    conversation_type=conversation_type,
                )
                session.add(conversation)
                session.flush()  # Используем flush вместо commit
                session.refresh(conversation)
                logger.debug(f"Created multi-agent conversation {conversation.id} for user {user_id}")
                
                # Добавляем агентов в разговор (только для agents_only)
                agent_ids_list = conversation_data.agent_ids or []
                if conversation_type == "agents_only":
                    for agent_id in agent_ids_list:
                        conversation_agent = ConversationAgent(
                            conversation_id=conversation.id,
                            agent_id=agent_id
                        )
                        session.add(conversation_agent)
                
                # Перемещаем новый групповой чат на первое место во всех папках пользователя
                from services.folder_service import FolderService
                folder_service = FolderService()
                folder_service.move_chat_to_top_in_all_folders(conversation.id, user_id, session)
                session.commit()  # Коммитим все изменения вместе
                
                agent_ids_list = conversation_data.agent_ids or []
                agent_count = len(agent_ids_list) if conversation_type == "agents_only" else 0
                logger.info(f"Successfully created multi-agent conversation {conversation.id} for user {user_id} with type {conversation_type} (agents: {agent_count})")
                
                return {
                    "conversation_id": conversation.id,
                    "title": conversation.title,
                    "description": conversation.description,
                    "user_id": user_id,
                    "group_avatar": conversation.group_avatar or "group",
                    "group_avatar_url": conversation.group_avatar_url,
                    "conversation_type": conversation.conversation_type or "agents_only",
                    "unread_count": conversation.unread_count or 0,
                    "agent_count": len(conversation_data.agent_ids) if conversation_type == "agents_only" else 0,
                    "created_at": conversation.created_at.isoformat() + 'Z' if conversation.created_at else None
                }
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating multi-agent conversation for user {user_id}: {e}", exc_info=True)
            raise
    
    def add_agent_to_conversation(self, conversation_id: int, agent_id: int, agent_service) -> bool:
        """Добавить агента в существующий разговор
        
        Args:
            conversation_id: ID разговора
            agent_id: ID агента
            agent_service: Сервис агентов
            
        Returns:
            True, если агент успешно добавлен, False в противном случае
            
        Raises:
            ValueError: При ошибках валидации
        """
        try:
            with self.get_session() as session:
                # Проверяем, существует ли разговор
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return False
                
                # Проверяем, существует ли агент и активен ли он
                agent = session.get(Agent, agent_id)
                if not agent:
                    return False
                if not agent_service.is_agent_active(agent_id):
                    return False
                
                # Проверяем, не добавлен ли уже агент
                existing = session.exec(
                    select(ConversationAgent)
                    .where(ConversationAgent.conversation_id == conversation_id)
                    .where(ConversationAgent.agent_id == agent_id)
                ).first()
                
                if existing:
                    return False
                
                # Добавляем агента
                conversation_agent = ConversationAgent(
                    conversation_id=conversation_id,
                    agent_id=agent_id
                )
                session.add(conversation_agent)
                session.commit()
                logger.debug(f"Added agent {agent_id} to conversation {conversation_id}")
                return True
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
            with self.get_session() as session:
                conversation_agent = session.exec(
                    select(ConversationAgent)
                    .where(ConversationAgent.conversation_id == conversation_id)
                    .where(ConversationAgent.agent_id == agent_id)
                ).first()
                
                if not conversation_agent:
                    return False
                
                session.delete(conversation_agent)
                session.commit()
                logger.debug(f"Removed agent {agent_id} from conversation {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"Error removing agent {agent_id} from conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def get_conversation_agents(self, conversation_id: int) -> List[Dict[str, Any]]:
        """Получить список агентов в разговоре
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            Список агентов в разговоре
        """
        try:
            with self.get_session() as session:
                conversation_agents = session.exec(
                    select(ConversationAgent)
                    .where(ConversationAgent.conversation_id == conversation_id)
                    .where(ConversationAgent.is_active == True)
                ).all()
                
                agents = []
                for ca in conversation_agents:
                    agent = session.get(Agent, ca.agent_id)
                    if agent:
                        agents.append({
                            "id": agent.id,
                            "name": agent.name,
                            "instructions": agent.instructions,
                            "model": agent.model,
                            "added_at": ca.added_at
                        })
                
                return agents
        except Exception as e:
            logger.error(f"Error getting agents for conversation {conversation_id}: {e}", exc_info=True)
            return []
    
    def get_conversation(self, conversation_id: int, user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Получить конкретный многопользовательский разговор
        
        Args:
            conversation_id: ID разговора
            user_id: ID пользователя для проверки прав доступа (опционально)
        """
        try:
            with self.get_session() as session:
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    logger.warning(f"Multi-agent conversation {conversation_id} not found")
                    return None
                
                # ВАЖНО: проверяем, что у чата есть владелец (user_id не NULL)
                # Чаты без владельца не должны быть доступны
                if conversation.user_id is None:
                    logger.warning(f"Multi-agent conversation {conversation_id} has no owner (user_id = None)")
                    return None
                
                # ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: если передан user_id, проверяем права доступа
                if user_id is not None and conversation.user_id != user_id:
                    logger.warning(f"Access denied: conversation {conversation_id} belongs to user_id={conversation.user_id}, requested by user_id={user_id}")
                    return None
                
                logger.debug(f"Found multi-agent conversation {conversation.id} for user {conversation.user_id}")
                agents = self.get_conversation_agents(conversation_id)
                # ВАЖНО: убеждаемся, что user_id всегда присутствует в ответе
                user_id_val = conversation.user_id if conversation.user_id is not None else None
                return {
                    "id": conversation.id,
                    "title": conversation.title,
                    "description": conversation.description,
                    "group_avatar": conversation.group_avatar or "group",
                    "group_avatar_url": conversation.group_avatar_url,
                    "conversation_type": conversation.conversation_type or "agents_only",
                    "user_id": user_id_val,  # Явно устанавливаем user_id
                    "created_at": conversation.created_at.isoformat() + 'Z' if conversation.created_at else None,
                    "updated_at": conversation.updated_at.isoformat() + 'Z' if conversation.updated_at else None,
                    "unread_count": conversation.unread_count or 0,
                    "agent_count": len(agents),
                    "agents": agents
                }
        except Exception as e:
            logger.error(f"Error getting multi-agent conversation {conversation_id}: {e}", exc_info=True)
            return None
    
    def get_conversations(self, user_id: int) -> List[Dict[str, Any]]:
        """Получить список многопользовательских разговоров пользователя, отсортированных по времени последнего обновления
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Список разговоров пользователя
        """
        try:
            with self.get_session() as session:
                logger.debug(f"Getting multi-agent conversations for user {user_id}")
                
                # ВАЖНО: фильтруем по user_id И явно исключаем NULL значения
                # Это защищает от ситуации, когда в БД есть старые записи без user_id
                statement = (
                    select(MultiAgentConversation)
                    .where(MultiAgentConversation.user_id == user_id)
                    .where(col(MultiAgentConversation.user_id).isnot(None))  # Явно исключаем NULL
                    .order_by(MultiAgentConversation.updated_at.desc())
                )
                
                conversations = session.exec(statement).all()
                logger.debug(f"Found {len(conversations)} conversations after filtering by user_id={user_id}")
                
                # ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: еще раз проверяем каждый чат перед добавлением
                result = []
                for conv in conversations:
                    # КРИТИЧЕСКАЯ ПРОВЕРКА: убеждаемся, что чат действительно принадлежит этому пользователю
                    # Используем явное преобразование типов для надежности
                    conv_user_id = int(conv.user_id) if conv.user_id is not None else None
                    requested_user_id = int(user_id)
                    if conv_user_id != requested_user_id:
                        logger.warning(f"Filtered out conversation {conv.id}: user_id mismatch (conv_user_id={conv_user_id}, requested={requested_user_id})")
                        continue
                    
                    agents = self.get_conversation_agents(conv.id)
                    # ВАЖНО: убеждаемся, что user_id всегда присутствует в ответе
                    user_id_val = conv.user_id if conv.user_id is not None else None
                    conv_dict = {
                        "id": conv.id,
                        "title": conv.title,
                        "description": conv.description,
                        "group_avatar": conv.group_avatar or "group",
                        "group_avatar_url": conv.group_avatar_url,
                        "conversation_type": conv.conversation_type or "agents_only",
                        "user_id": user_id_val,  # Явно устанавливаем user_id
                        "created_at": conv.created_at.isoformat() if conv.created_at else None,
                        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
                        "unread_count": conv.unread_count or 0,
                        "agent_count": len(agents),
                        "agents": agents
                    }
                    result.append(conv_dict)
                
                logger.info(f"Returned {len(result)} multi-agent conversations for user {user_id}")
                return result
        except Exception as e:
            logger.error(f"Error getting multi-agent conversations for user {user_id}: {e}", exc_info=True)
            return []
    
    def delete_conversation(self, conversation_id: int) -> bool:
        """Удалить многопользовательский разговор
        
        Args:
            conversation_id: ID разговора
            
        Returns:
            True, если разговор успешно удален, False в противном случае
        """
        try:
            with self.get_session() as session:
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    return False
                
                # Удаляем все файлы, связанные с разговором
                # Для multi-agent conversations файлы привязаны через conversation_id
                try:
                    deleted_files_count = self.file_storage_service.delete_files_by_conversation(session, conversation_id)
                    if deleted_files_count > 0:
                        logger.info(f"Deleted {deleted_files_count} file(s) associated with multi-agent conversation {conversation_id}")
                except Exception as e:
                    logger.error(f"Error deleting files for multi-agent conversation {conversation_id}: {e}", exc_info=True)
                    # Продолжаем удаление разговора даже если удаление файлов не удалось
                
                # Удаляем все сообщения разговора
                from models.message import Message
                messages = session.exec(
                    select(Message).where(Message.multi_agent_conversation_id == conversation_id)
                ).all()
                for message in messages:
                    session.delete(message)
                
                # Удаляем связи с агентами
                conversation_agents = session.exec(
                    select(ConversationAgent).where(ConversationAgent.conversation_id == conversation_id)
                ).all()
                for ca in conversation_agents:
                    session.delete(ca)
                
                # Удаляем разговор
                session.delete(conversation)
                session.commit()
                logger.info(f"Deleted multi-agent conversation {conversation_id}")
                return True
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}", exc_info=True)
            return False
    
    def update_conversation_title(self, conversation_id: int, title: str) -> bool:
        """Обновить название группового чата
        
        Args:
            conversation_id: ID разговора
            title: Новое название
            
        Returns:
            True, если успешно, False в противном случае
        """
        try:
            with self.get_session() as session:
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    logger.warning(f"Conversation {conversation_id} not found")
                    return False
                
                old_title = conversation.title
                conversation.title = title.strip() if title else None
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(conversation)
                
                logger.info(f"✅ Title updated for conversation {conversation_id}: '{old_title}' -> '{conversation.title}'")
                return True
        except Exception as e:
            logger.error(f"❌ Error updating title for conversation {conversation_id}: {e}", exc_info=True)
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
            with self.get_session() as session:
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    logger.warning(f"Conversation {conversation_id} not found")
                    return False
                
                # Валидируем аватар
                allowed_group_avatars = {
                    "group", "groups", "group_add", "group_work", "diversity",
                    "people_alt", "emoji_people", "connect", "interpreter",
                    "chat", "comedy", "star", "fire", "diamond", "star_border",
                    "fa_people_group", "team_fill",
                }
                if group_avatar not in allowed_group_avatars:
                    group_avatar = "group"
                
                conversation.group_avatar = group_avatar
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(conversation)
                
                logger.info(f"✅ Avatar updated for conversation {conversation_id}: '{group_avatar}'")
                return True
        except Exception as e:
            logger.error(f"❌ Error updating avatar for conversation {conversation_id}: {e}", exc_info=True)
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
            with self.get_session() as session:
                conversation = session.get(MultiAgentConversation, conversation_id)
                if not conversation:
                    logger.warning(f"Conversation {conversation_id} not found")
                    return False
                
                # Валидируем аватар
                allowed_group_avatars = {
                    "group", "groups", "group_add", "group_work", "diversity",
                    "people_alt", "emoji_people", "connect", "interpreter",
                    "chat", "comedy", "star", "fire", "diamond", "star_border",
                    "fa_people_group", "team_fill",
                }
                if group_avatar not in allowed_group_avatars:
                    group_avatar = "group"
                
                conversation.group_avatar = group_avatar
                conversation.group_avatar_url = group_avatar_url
                conversation.updated_at = datetime.utcnow()
                
                session.commit()
                session.refresh(conversation)
                
                logger.info(f"✅ Avatar URL updated for conversation {conversation_id}: group_avatar='{group_avatar}', group_avatar_url='{group_avatar_url}'")
                return True
        except Exception as e:
            logger.error(f"❌ Error updating avatar URL for conversation {conversation_id}: {e}", exc_info=True)
            return False