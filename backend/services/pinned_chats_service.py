import logging
from typing import List

from services.base_service import BaseService
from models.user import User
from models.conversation import Conversation
from models.multi_agent_conversation import MultiAgentConversation
from core.database import ensure_user_pinned_chats_column

logger = logging.getLogger(__name__)


class PinnedChatsService(BaseService):
    """Сервис для управления закрепленными чатами пользователя."""

    def __init__(self):
        super().__init__()

    def get_pinned_chats(self, user_id: int) -> List[int]:
        """Получить список закрепленных чатов пользователя."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while fetching pinned chats", user_id)
                return []
            return user.get_pinned_chat_ids()

    def set_pinned_chats(self, user_id: int, chat_ids: List[int]) -> List[int]:
        """Полностью заменить список закрепленных чатов пользователя."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while setting pinned chats", user_id)
                return []

            valid_ids = self._filter_accessible_chat_ids(session, user_id, chat_ids)
            user.set_pinned_chat_ids(valid_ids)
            session.add(user)
            session.commit()
            session.refresh(user)

            logger.debug(
                "Pinned chats for user %s updated to %s",
                user_id,
                user.get_pinned_chat_ids(),
            )
            return user.get_pinned_chat_ids()

    def pin_chat(self, user_id: int, chat_id: int) -> List[int]:
        """Закрепить чат за пользователем."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            self._ensure_chat_access(session, user_id, chat_id)
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while pinning chat %s", user_id, chat_id)
                return []

            changed = user.add_pinned_chat(chat_id)
            if changed:
                session.add(user)
                session.commit()
                session.refresh(user)
                logger.info("Chat %s pinned for user %s", chat_id, user_id)
            else:
                logger.debug("Chat %s already pinned for user %s", chat_id, user_id)
            return user.get_pinned_chat_ids()

    def unpin_chat(self, user_id: int, chat_id: int) -> List[int]:
        """Открепить чат пользователя."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while unpinning chat %s", user_id, chat_id)
                return []

            changed = user.remove_pinned_chat(chat_id)
            if changed:
                session.add(user)
                session.commit()
                session.refresh(user)
                logger.info("Chat %s unpinned for user %s", chat_id, user_id)
            else:
                logger.debug("Chat %s was not pinned for user %s", chat_id, user_id)
            return user.get_pinned_chat_ids()

    def toggle_chat(self, user_id: int, chat_id: int) -> List[int]:
        """Переключить состояние закрепления чата."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            self._ensure_chat_access(session, user_id, chat_id)
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while toggling chat %s", user_id, chat_id)
                return []

            user.toggle_pinned_chat(chat_id)
            session.add(user)
            session.commit()
            session.refresh(user)

            logger.info("Chat %s toggled for user %s", chat_id, user_id)
            return user.get_pinned_chat_ids()

    def is_chat_pinned(self, user_id: int, chat_id: int) -> bool:
        """Проверить, закреплен ли чат."""
        ensure_user_pinned_chats_column()
        with self.get_session() as session:
            user = session.get(User, user_id)
            if not user:
                logger.warning("User %s not found while checking pinned state for chat %s", user_id, chat_id)
                return False
            return user.is_chat_pinned(chat_id)

    def _ensure_chat_access(self, session, user_id: int, chat_id: int) -> None:
        """Убедиться, что чат принадлежит пользователю."""
        conversation = session.get(Conversation, chat_id)
        if conversation:
            if conversation.user_id != user_id:
                logger.warning(
                    "User %s attempted to modify chat %s owned by %s",
                    user_id,
                    chat_id,
                    conversation.user_id,
                )
                raise PermissionError("Access denied")
            return

        multi_conversation = session.get(MultiAgentConversation, chat_id)
        if multi_conversation:
            if multi_conversation.user_id != user_id:
                logger.warning(
                    "User %s attempted to modify multi-agent chat %s owned by %s",
                    user_id,
                    chat_id,
                    multi_conversation.user_id,
                )
                raise PermissionError("Access denied")
            return

        logger.warning("Chat %s not found while ensuring access for user %s", chat_id, user_id)
        raise ValueError("Chat not found")

    def _filter_accessible_chat_ids(self, session, user_id: int, chat_ids: List[int]) -> List[int]:
        """Оставить только доступные пользователю чаты."""
        valid_ids: List[int] = []
        for chat_id in chat_ids:
            try:
                normalized_id = int(chat_id)
            except (TypeError, ValueError):
                continue

            try:
                self._ensure_chat_access(session, user_id, normalized_id)
            except (PermissionError, ValueError):
                continue

            if normalized_id not in valid_ids:
                valid_ids.append(normalized_id)

        return valid_ids

