import logging
from typing import List

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel

from core.dependencies import get_current_active_user
from models.user import User
from services.pinned_chats_service import PinnedChatsService

logger = logging.getLogger(__name__)


class PinnedChatsResponse(BaseModel):
    pinned_chats: List[int]


class PinStatusResponse(BaseModel):
    is_pinned: bool


def create_pinned_chats_endpoints(app, pinned_chats_service: PinnedChatsService):
    """Создать эндпоинты для управления закрепленными чатами."""

    @app.get("/pinned-chats/", response_model=PinnedChatsResponse)
    def list_pinned_chats(
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            pinned = pinned_chats_service.get_pinned_chats(current_user.id)
            return PinnedChatsResponse(pinned_chats=pinned)
        except Exception as exc:
            logger.error(
                "Failed to get pinned chats for user %s: %s",
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get pinned chats",
            )

    @app.post("/pinned-chats/{chat_id}/pin", response_model=PinnedChatsResponse)
    def pin_chat(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            pinned = pinned_chats_service.pin_chat(current_user.id, chat_id)
            return PinnedChatsResponse(pinned_chats=pinned)
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )
        except Exception as exc:
            logger.error(
                "Error pinning chat %s for user %s: %s",
                chat_id,
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to pin chat",
            )

    @app.delete("/pinned-chats/{chat_id}/pin", response_model=PinnedChatsResponse)
    def unpin_chat(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            pinned = pinned_chats_service.unpin_chat(current_user.id, chat_id)
            return PinnedChatsResponse(pinned_chats=pinned)
        except Exception as exc:
            logger.error(
                "Error unpinning chat %s for user %s: %s",
                chat_id,
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to unpin chat",
            )

    @app.post("/pinned-chats/{chat_id}/toggle", response_model=PinnedChatsResponse)
    def toggle_pin_chat(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            pinned = pinned_chats_service.toggle_chat(current_user.id, chat_id)
            return PinnedChatsResponse(pinned_chats=pinned)
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat not found",
            )
        except Exception as exc:
            logger.error(
                "Error toggling pin for chat %s and user %s: %s",
                chat_id,
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to toggle pinned state",
            )

    @app.get("/pinned-chats/{chat_id}/status", response_model=PinStatusResponse)
    def get_pin_status(
        chat_id: int,
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            is_pinned = pinned_chats_service.is_chat_pinned(current_user.id, chat_id)
            return PinStatusResponse(is_pinned=is_pinned)
        except Exception as exc:
            logger.error(
                "Error getting pin status for chat %s and user %s: %s",
                chat_id,
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get pin status",
            )

    @app.put("/pinned-chats/", response_model=PinnedChatsResponse)
    def set_pinned_chats(
        chat_ids: List[int],
        current_user: User = Depends(get_current_active_user),
    ):
        try:
            pinned = pinned_chats_service.set_pinned_chats(current_user.id, chat_ids)
            return PinnedChatsResponse(pinned_chats=pinned)
        except Exception as exc:
            logger.error(
                "Error setting pinned chats for user %s: %s",
                current_user.id,
                exc,
                exc_info=True,
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to set pinned chats",
            )

