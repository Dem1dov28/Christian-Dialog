from fastapi import Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
import logging

from core.dependencies import get_current_active_user, get_session
from models.user import User
from models.conversation import Conversation
from models.message import Message
from models.multi_agent_conversation import MultiAgentConversation
from services.conversation_service import ConversationService

logger = logging.getLogger(__name__)

# Модели для запросов и ответов
class SavedMessageCreate(BaseModel):
    original_message_id: int = Field(ge=1, description="ID оригинального сообщения")
    original_chat_id: int = Field(ge=0, description="ID оригинального чата")
    original_chat_name: str = Field(min_length=1, description="Название оригинального чата")
    original_agent_name: Optional[str] = Field(None, description="Название оригинального агента")
    is_from_user: bool = Field(default=True, description="Является ли сообщение от пользователя")

class SavedMessageResponse(BaseModel):
    id: int
    content: str
    message_type: str = "text"
    original_message_id: int
    original_chat_id: int
    original_chat_name: str
    original_agent_name: Optional[str] = None
    saved_at: datetime
    original_created_at: datetime
    is_accessible: bool = True


def create_saved_messages_endpoints(app, conversation_service_instance: ConversationService):
    """Создать эндпоинты для сохраненных сообщений"""
    
    def verify_message_access(message: Message, current_user: User, db: Session) -> bool:
        """Проверить права доступа к сообщению"""
        if message.conversation_id:
            # Обычный чат
            conversation = db.get(Conversation, message.conversation_id)
            if conversation and conversation.user_id == current_user.id:
                return True
        elif message.multi_agent_conversation_id:
            # Мульти-агентный чат
            multi_conversation = db.get(MultiAgentConversation, message.multi_agent_conversation_id)
            if multi_conversation and multi_conversation.user_id == current_user.id:
                return True
        return False
    
    @app.post("/saved-messages/", response_model=SavedMessageResponse, status_code=status.HTTP_201_CREATED)
    async def save_message_to_saved_messages(
        saved_message_data: SavedMessageCreate,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Сохранить сообщение в Saved Messages"""
        try:
            # Получаем оригинальное сообщение
            original_message = db.get(Message, saved_message_data.original_message_id)
            if not original_message:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Original message not found"
                )
            
            # Проверяем права доступа к сообщению
            if not verify_message_access(original_message, current_user, db):
                logger.warning(
                    f"Access denied: user {current_user.id} tried to save message {saved_message_data.original_message_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this message"
                )
            
            # Получаем или создаем системный чат Saved Messages
            system_chat = conversation_service_instance.get_system_chat(current_user.id, "saved_messages")
            if not system_chat:
                system_chat = conversation_service_instance.create_system_chat(current_user.id, "saved_messages")
            
            system_chat_id = system_chat["id"]
            
            # Создаем новое сообщение в системном чате
            saved_message = Message(
                conversation_id=system_chat_id,
                content=original_message.content,
                is_from_user=saved_message_data.is_from_user,
                agent_id=None,
                original_message_id=saved_message_data.original_message_id,
                original_chat_name=saved_message_data.original_chat_name,
                original_agent_name=saved_message_data.original_agent_name
            )
            
            db.add(saved_message)
            db.commit()
            db.refresh(saved_message)
            
            logger.info(
                f"Message {saved_message_data.original_message_id} saved to Saved Messages by user {current_user.id}"
            )
            
            return SavedMessageResponse(
                id=saved_message.id,
                content=original_message.content,
                message_type="text",
                original_message_id=saved_message_data.original_message_id,
                original_chat_id=saved_message_data.original_chat_id,
                original_chat_name=saved_message_data.original_chat_name,
                original_agent_name=saved_message_data.original_agent_name,
                saved_at=datetime.utcnow(),
                original_created_at=original_message.created_at,
                is_accessible=True
            )
            
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving message: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )
    
    @app.get("/saved-messages/", response_model=List[SavedMessageResponse])
    async def get_saved_messages(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Получить список сохраненных сообщений"""
        try:
            # Получаем системный чат Saved Messages
            system_chat = conversation_service_instance.get_system_chat(current_user.id, "saved_messages")
            if not system_chat:
                return []
            
            system_chat_id = system_chat["id"]
            
            # Получаем сообщения из системного чата (только неудаленные)
            messages = db.exec(
                select(Message)
                .where(Message.conversation_id == system_chat_id)
                .where(Message.is_deleted == False)
                .order_by(Message.created_at.desc())
            ).all()
            
            # Преобразуем сообщения в SavedMessageResponse
            saved_messages = [
                SavedMessageResponse(
                    id=message.id,
                    content=message.content,
                    message_type="text",
                    original_message_id=message.original_message_id or 0,
                    original_chat_id=0,  # Будет заполнено при необходимости
                    original_chat_name=message.original_chat_name or "Unknown",
                    original_agent_name=message.original_agent_name,
                    saved_at=message.created_at,
                    original_created_at=message.created_at,
                    is_accessible=True
                )
                for message in messages
            ]
            
            logger.info(f"Retrieved {len(saved_messages)} saved messages for user {current_user.id}")
            return saved_messages
            
        except Exception as e:
            logger.error(f"Error getting saved messages: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )
