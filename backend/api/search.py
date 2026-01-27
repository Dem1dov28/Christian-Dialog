from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from typing import Annotated
from sqlmodel import Session
import logging

from core.dependencies import get_current_active_user, get_session
from models.user import User
from services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])

# Создаем экземпляр сервиса
search_service = SearchService()


@router.get("/conversations")
async def search_conversations(
    q: str = Query(..., min_length=1, description="Поисковый запрос"),
    limit: int = Query(20, ge=1, le=100, description="Максимальное количество результатов"),
    sort_by: str = Query("relevance", description="Сортировка: relevance, date, title"),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session)
):
    """Поиск по чатам пользователя с улучшенной релевантностью"""
    try:
        result = search_service.search_conversations(
            query=q,
            user_id=current_user.id,
            session=session,
            limit=limit,
            sort_by=sort_by
        )
        logger.info(f"Search conversations: query='{q}', found={result['total']} for user {current_user.id}")
        return result
    except Exception as e:
        logger.error(f"Error searching conversations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка поиска"
        )


@router.get("/conversations/{conversation_id}/messages")
async def search_messages_in_conversation(
    conversation_id: Annotated[int, Path(ge=1, description="ID разговора")],
    q: str = Query(..., min_length=1, description="Поисковый запрос"),
    limit: int = Query(75, ge=1, le=200, description="Максимальное количество результатов"),
    filter_type: str = Query("all", description="Тип фильтра: all, pinned"),
    sort_by: str = Query("relevance", description="Сортировка: relevance, date"),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session)
):
    """Поиск по сообщениям в конкретном чате (обычном или групповом) с улучшенной релевантностью"""
    try:
        result = search_service.search_messages_in_conversation(
            conversation_id=conversation_id,
            query=q,
            user_id=current_user.id,
            session=session,
            limit=limit,
            filter_type=filter_type,
            sort_by=sort_by
        )
        
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Чат не найден"
            )
        
        logger.info(
            f"Search messages in conversation {conversation_id}: query='{q}', "
            f"found={result['total']} for user {current_user.id}"
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching messages in conversation {conversation_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка поиска"
        )


@router.get("/messages")
async def search_messages(
    q: str = Query(..., min_length=1, description="Поисковый запрос"),
    limit: int = Query(75, ge=1, le=100, description="Максимальное количество результатов"),
    sort_by: str = Query("relevance", description="Сортировка: relevance, date"),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session)
):
    """Поиск сообщений по всем чатам пользователя (обычным и групповым)"""
    try:
        logger.info(f"Starting search for user {current_user.id} with query: '{q}'")
        result = search_service.search_messages(
            query=q,
            user_id=current_user.id,
            session=session,
            limit=limit,
            sort_by=sort_by
        )
        logger.info(f"Search messages: query='{q}', found={result['total']} for user {current_user.id}")
        return result
    except Exception as e:
        logger.error(f"Error searching messages for user {current_user.id} with query '{q}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка поиска"
        )


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1, description="Поисковый запрос"),
    limit: int = Query(30, ge=1, le=100, description="Максимальное количество результатов"),
    sort_by: str = Query("relevance", description="Сортировка: relevance, date"),
    current_user: User = Depends(get_current_active_user),
    session: Session = Depends(get_session)
):
    """Глобальный поиск по всем чатам и сообщениям пользователя с улучшенной релевантностью"""
    try:
        result = search_service.global_search(
            query=q,
            user_id=current_user.id,
            session=session,
            limit=limit,
            sort_by=sort_by
        )
        logger.info(f"Global search: query='{q}', found={result['total']} for user {current_user.id}")
        return result
    except Exception as e:
        logger.error(f"Error in global search: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка поиска"
        )
