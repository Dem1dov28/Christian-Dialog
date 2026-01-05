from typing import Annotated, Optional
from fastapi import Depends, HTTPException, Query, Path, status, Request
from sqlmodel import Session
import logging
from pydantic import BaseModel

from models.multi_agent_conversation import (
    MultiAgentConversationCreate, 
    MultiAgentConversationPublic
)
from models.message import MultiAgentChatMessage
from models.user import User
from core.database import get_session
from core.dependencies import get_current_active_user
from services.multi_agent_chat_service import MultiAgentChatService
from services.subscription_service import SubscriptionService
from services.conversation_service import ConversationService

logger = logging.getLogger(__name__)


def create_multi_agent_chat_endpoints(app, multi_agent_chat_service: MultiAgentChatService):
    """Создать эндпоинты для многопользовательских чатов"""
    
    conversation_service = ConversationService()
    
    def verify_conversation_access(conversation_id: int, current_user: User) -> dict:
        """Проверить права доступа к разговору"""
        conversation = multi_agent_chat_service.get_conversation(conversation_id, current_user.id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        return conversation
    
    @app.post("/multi-agent-chat/new", status_code=status.HTTP_201_CREATED)
    async def create_multi_agent_conversation(
        conversation_data: MultiAgentConversationCreate, 
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Создать новый многопользовательский чат
        
        Примечание: Этот эндпоинт только для чатов с агентами (agents_only).
        """
        try:
            # Проверяем, что тип чата agents_only (по умолчанию или явно указан)
            conversation_type = conversation_data.conversation_type or "agents_only"
            if conversation_type != "agents_only":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This endpoint is for agents-only chats."
                )
            
            result = multi_agent_chat_service.create_conversation(conversation_data, current_user.id)
            logger.info(
                f"Multi-agent conversation created: id={result.get('conversation_id')}, "
                f"title='{conversation_data.title}', user_id={current_user.id}"
            )
            return result
        except ValueError as e:
            logger.warning(f"Validation error creating multi-agent conversation: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error creating multi-agent conversation: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error creating conversation"
            )
    
    @app.post("/multi-agent-chat/{conversation_id}/add-agent/{agent_id}")
    def add_agent_to_conversation(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        agent_id: Annotated[int, Path(ge=1, description="ID агента")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Добавить агента в существующий разговор
        
        """
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.add_agent_to_conversation(conversation_id, agent_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to add agent to conversation"
                )
            
            logger.info(f"Agent {agent_id} added to conversation {conversation_id} by user {current_user.id}")
            return {"ok": True, "message": "Agent added successfully"}
        except ValueError as e:
            # Обрабатываем ошибку типа чата
            logger.warning(f"Validation error adding agent {agent_id} to conversation {conversation_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error adding agent {agent_id} to conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось добавить агента в разговор"
            )
    
    @app.delete("/multi-agent-chat/{conversation_id}/remove-agent/{agent_id}")
    def remove_agent_from_conversation(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        agent_id: Annotated[int, Path(ge=1, description="ID агента")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить агента из разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.remove_agent_from_conversation(conversation_id, agent_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to remove agent from conversation"
                )
            
            logger.info(f"Agent {agent_id} removed from conversation {conversation_id} by user {current_user.id}")
            return {"ok": True, "message": "Agent removed successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error removing agent {agent_id} from conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить агента из разговора"
            )
    
    @app.get("/multi-agent-chat/{conversation_id}/agents")
    def get_conversation_agents(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить список агентов в разговоре"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            agents = multi_agent_chat_service.get_conversation_agents(conversation_id)
            logger.info(f"Retrieved {len(agents)} agents for conversation {conversation_id}")
            return {"agents": agents}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting agents for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список агентов"
            )
    
    @app.post("/multi-agent-chat/send")
    async def send_message_to_multi_agent_chat(
        message_data: MultiAgentChatMessage, 
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Отправить сообщение в многопользовательский чат"""
        try:
            # Проверяем статус подписки (передаем сессию для сброса цикла)
            SubscriptionService.check_subscription_status(current_user, session)
            
            # Проверяем лимит сообщений перед отправкой
            if not SubscriptionService.can_send_message(current_user, session):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Message limit exceeded. Please upgrade your subscription."
                )
            
            # Валидация входных данных
            if not message_data.message or not message_data.message.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Message cannot be empty"
                )
            
            if not message_data.conversation_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid conversation ID"
                )
            
            # Преобразуем conversation_id в int для валидации
            conversation_id = int(message_data.conversation_id)
            if conversation_id <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid conversation ID"
                )
            
            # Проверяем права доступа к разговору
            conversation = verify_conversation_access(conversation_id, current_user)
            
            # Проверяем тип чата - /multi-agent-chat/send должен работать только с agents_only
            conversation_type = conversation.get("conversation_type") or "agents_only"
            if conversation_type != "agents_only":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This endpoint is for multi-agent chats only."
                )
            
            # Увеличиваем счетчик сообщений пользователя
            if not SubscriptionService.increment_message_count(session, current_user):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Message limit exceeded. Please upgrade your subscription."
                )
            
            result = await multi_agent_chat_service.send_message(message_data)
            logger.info(f"Message sent to multi-agent conversation {conversation_id} by user {current_user.id}")
            return result
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Validation error sending message: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error processing multi-agent message: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error processing message"
            )
    
    @app.get("/multi-agent-chat/{conversation_id}/messages")
    def get_conversation_messages(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user),
        offset: int = Query(0, ge=0, description="Смещение для пагинации (количество уже загруженных сообщений, используется только если before_date не указан)"),
        max_chars: int = Query(10000, ge=1, le=50000, description="Максимальное количество символов для загрузки"),
        before_date: Optional[str] = Query(None, description="ISO строка даты - загружать сообщения, которые были созданы ДО этой даты (для правильной подгрузки старых)"),
    ):
        """Получить сообщения из многопользовательского разговора с лимитом по символам"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Получаем все сообщения
            all_messages = multi_agent_chat_service.get_conversation_messages(conversation_id)
            
            # Применяем логику с лимитом по символам
            if offset == 0 and not before_date:
                # Первая загрузка: берем последние сообщения до лимита символов
                result = []
                total_chars = 0
                for message in reversed(all_messages):  # От новых к старым
                    message_chars = len(message.get("content", "") or "")
                    if total_chars + message_chars > max_chars:
                        break
                    total_chars += message_chars
                    result.insert(0, message)  # Вставляем в начало, чтобы сохранить порядок от старых к новым
            else:
                # Подгрузка старых сообщений
                from datetime import datetime
                
                if before_date:
                    # Используем before_date для правильной последовательности
                    try:
                        if 'T' in before_date:
                            before_datetime = datetime.fromisoformat(before_date.replace('Z', '+00:00'))
                        else:
                            before_datetime = datetime.fromisoformat(before_date)
                        
                        # Фильтруем сообщения ДО указанной даты и сортируем от новых к старым
                        filtered_messages = [
                            msg for msg in all_messages 
                            if msg.get("created_at") and datetime.fromisoformat(msg["created_at"].replace('Z', '+00:00')) < before_datetime
                        ]
                        filtered_messages.sort(key=lambda m: m.get("created_at", ""), reverse=True)  # От новых к старым
                    except Exception as e:
                        logger.warning(f"Invalid before_date format: {before_date}, error: {e}, using offset fallback")
                        filtered_messages = all_messages[offset:]
                else:
                    # Fallback: используем offset
                    filtered_messages = all_messages[offset:]
                
                # Берем следующую порцию до лимита символов (10000)
                result = []
                total_chars = 0
                for message in filtered_messages:
                    message_chars = len(message.get("content", "") or "")
                    if total_chars + message_chars > max_chars:
                        break
                    total_chars += message_chars
                    result.append(message)
                
                # Если использовали before_date, разворачиваем список (т.к. сортировали от новых к старым)
                if before_date:
                    result = list(reversed(result))
            
            total_chars = sum(len(msg.get("content", "") or "") for msg in result)
            logger.info(
                f"Retrieved {len(result)} messages for conversation {conversation_id} "
                f"(offset={offset}, before_date={before_date}, total_chars={total_chars}, max_chars={max_chars})"
            )
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error loading messages for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error loading messages"
            )
    
    @app.get("/multi-agent-chat/")
    def get_multi_agent_conversations(
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        limit: int = Query(1000, le=1000, ge=1, description="Количество записей"),
    ):
        """Получить список многопользовательских разговоров текущего пользователя"""
        try:
            conversations = multi_agent_chat_service.get_conversations(current_user.id)
            
            # Применяем пагинацию
            paginated_conversations = conversations[offset:offset + limit]
            
            logger.info(
                f"Retrieved {len(paginated_conversations)} multi-agent conversations for user {current_user.id} "
                f"(offset={offset}, limit={limit}, total={len(conversations)})"
            )
            return paginated_conversations
        except Exception as e:
            logger.error(f"Error getting multi-agent conversations for user {current_user.id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список разговоров"
            )
    
    @app.get("/multi-agent-chat/{conversation_id}", response_model=MultiAgentConversationPublic)
    def get_multi_agent_conversation(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить многопользовательский разговор по ID"""
        try:
            return verify_conversation_access(conversation_id, current_user)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить разговор"
            )
    
    @app.post("/multi-agent-chat/{conversation_id}/continue-dialogue")
    async def continue_agent_dialogue(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        request: Request,
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Продолжить диалог между агентами без участия пользователя"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Получаем параметры из тела запроса
            language = None
            is_chat_active = False
            try:
                body = await request.json()
                language = body.get("language")
                is_chat_active = body.get("is_chat_active", False)
            except:
                pass
            
            result = await multi_agent_chat_service.continue_dialogue(conversation_id, language=language, is_chat_active=is_chat_active)
            logger.info(f"Dialogue continued for conversation {conversation_id} by user {current_user.id} (chat_active={is_chat_active})")
            return result
        except HTTPException:
            raise
        except ValueError as e:
            logger.warning(f"Validation error continuing dialogue: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        except Exception as e:
            logger.error(f"Error continuing dialogue for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error continuing dialogue"
            )
    
    @app.delete("/multi-agent-chat/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_multi_agent_conversation(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        session: Session = Depends(get_session),
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить многопользовательский разговор"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.delete_conversation(conversation_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
            
            logger.info(f"Multi-agent conversation {conversation_id} deleted by user {current_user.id}")
            return None
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить разговор"
            )
    
    @app.post("/multi-agent-chat/{conversation_id}/messages/{message_id}/pin")
    def pin_message_in_multi_agent_chat(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        message_id: Annotated[int, Path(ge=1, description="ID сообщения")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Закрепить сообщение в многопользовательском чате"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.pin_message(conversation_id, message_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message or conversation not found"
                )
            
            logger.info(f"Message {message_id} pinned in conversation {conversation_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error pinning message {message_id} in conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось закрепить сообщение"
            )
    
    @app.delete("/multi-agent-chat/{conversation_id}/messages/pin")
    def unpin_message_in_multi_agent_chat(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Открепить сообщение в многопользовательском чате"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.unpin_message(conversation_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No pinned message found"
                )
            
            logger.info(f"Message unpinned in conversation {conversation_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error unpinning message in conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось открепить сообщение"
            )
    
    @app.get("/multi-agent-chat/{conversation_id}/pinned-message")
    def get_pinned_message_in_multi_agent_chat(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить закрепленное сообщение многопользовательского чата"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            pinned_message = multi_agent_chat_service.get_pinned_message(conversation_id)
            if not pinned_message:
                return None
            return pinned_message
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting pinned message for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить закрепленное сообщение"
            )
    
    @app.get("/multi-agent-chat/{conversation_id}/pinned-messages")
    def get_pinned_messages_in_multi_agent_chat(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить все закрепленные сообщения группового чата"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            pinned_messages = multi_agent_chat_service.get_pinned_messages(conversation_id)
            logger.info(
                f"Retrieved {len(pinned_messages)} pinned messages for conversation {conversation_id}"
            )
            return pinned_messages
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting pinned messages for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить закрепленные сообщения"
            )
    
    @app.delete("/multi-agent-chat/{conversation_id}/messages/{message_id}/pin")
    def unpin_specific_message_in_multi_agent_chat(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        message_id: Annotated[int, Path(ge=1, description="ID сообщения")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Открепить конкретное сообщение в групповом чате"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            success = multi_agent_chat_service.unpin_specific_message(conversation_id, message_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Message not found or not pinned"
                )
            
            logger.info(
                f"Message {message_id} unpinned in conversation {conversation_id} by user {current_user.id}"
            )
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Error unpinning message {message_id} in conversation {conversation_id}: {e}", exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось открепить сообщение"
            )
    
    @app.post("/multi-agent-chat/{conversation_id}/mark-as-read")
    def mark_multi_agent_conversation_as_read(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Пометить групповой чат как прочитанный"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            conversation_service.reset_unread_count(conversation_id, is_group_chat=True)
            
            logger.info(f"Conversation {conversation_id} marked as read by user {current_user.id}")
            return {"ok": True, "message": "Conversation marked as read", "unread_count": 0}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error marking conversation {conversation_id} as read: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось пометить разговор как прочитанный"
            )
    
    @app.post("/multi-agent-chat/{conversation_id}/clear")
    def clear_multi_agent_conversation_messages(
        conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Очистить все сообщения из группового разговора"""
        try:
            verify_conversation_access(conversation_id, current_user)
            
            # Очищаем сообщения через conversation_service
            conversation_service = ConversationService()
            success = conversation_service.clear_conversation_messages(conversation_id)
            
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to clear conversation messages"
                )
            
            logger.info(
                f"Multi-agent conversation {conversation_id} messages cleared by user {current_user.id}"
            )
            return {"ok": True, "message": "Multi-agent conversation messages cleared successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error clearing messages for conversation {conversation_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to clear conversation messages"
            )
