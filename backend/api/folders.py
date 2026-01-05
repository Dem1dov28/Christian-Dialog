from typing import Annotated, List, Optional
from fastapi import Depends, HTTPException, Query, Path, status
import logging

from models.folder import FolderPublic, FolderCreate, FolderUpdate
from models.user import User
from core.dependencies import get_current_active_user
from services.folder_service import FolderService

logger = logging.getLogger(__name__)


def create_folder_endpoints(app, folder_service: FolderService):
    """Создать эндпоинты для папок"""
    
    def verify_folder_access(folder_id: int, current_user: User) -> FolderPublic:
        """Проверить права доступа к папке"""
        logger.debug(f"Verifying access to folder {folder_id} for user {current_user.id} ({current_user.username})")
        folder = folder_service.get_folder(folder_id, current_user.id)
        if not folder:
            logger.warning(f"Folder {folder_id} not found for user {current_user.id} ({current_user.username})")
            # Проверяем, существует ли папка вообще (для лучшего сообщения об ошибке)
            from sqlmodel import Session, select
            from core.database import engine
            from models.folder import Folder as FolderModel
            with Session(engine) as session:
                folder_exists = session.get(FolderModel, folder_id)
                if folder_exists:
                    logger.warning(f"Folder {folder_id} exists but belongs to user {folder_exists.user_id}, not {current_user.id}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Access denied to folder {folder_id}"
                    )
                else:
                    logger.warning(f"Folder {folder_id} does not exist")
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Folder {folder_id} not found"
                    )
        logger.debug(f"Access verified: folder {folder_id} belongs to user {current_user.id}")
        return folder
    
    @app.post("/folders/", response_model=FolderPublic, status_code=status.HTTP_201_CREATED)
    def create_folder(
        folder: FolderCreate, 
        current_user: User = Depends(get_current_active_user)
    ):
        """Создать новую пользовательскую папку"""
        try:
            # Убеждаемся, что не создается системная папка
            if folder.folder_type == "system":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Системные папки нельзя создавать вручную"
                )
            
            # Устанавливаем folder_type="custom" по умолчанию
            if not folder.folder_type:
                folder.folder_type = "custom"
            
            new_folder = folder_service.create_folder(folder, current_user.id)
            logger.info(f"Folder created: id={new_folder.id}, name='{new_folder.name}' by user {current_user.id}")
            return new_folder
        except HTTPException:
            raise
        except ValueError as e:
            logger.error(f"Error creating folder: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e)
            )
        except Exception as e:
            logger.error(f"Error creating folder: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось создать папку: {str(e)}"
            )
    
    @app.get("/folders/", response_model=List[FolderPublic])
    def get_folders(
        current_user: User = Depends(get_current_active_user),
        folder_type: Optional[str] = Query(None, description="Тип папки для фильтрации"),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        limit: int = Query(100, le=100, ge=1, description="Количество записей"),
    ):
        """Получить все папки пользователя"""
        try:
            logger.info(f"GET folders request: user_id={current_user.id}, username={current_user.username}, folder_type={folder_type}")
            # Убеждаемся, что у пользователя есть системные папки
            folder_service.ensure_system_folders_exist(current_user.id)
            
            folders = folder_service.get_folders(current_user.id, folder_type)
            paginated_folders = folders[offset:offset + limit]
            logger.info(f"Retrieved {len(paginated_folders)} folders for user {current_user.id} ({current_user.username}) (type: {folder_type or 'all'})")
            # Логируем ID папок для диагностики
            folder_ids = [f.id for f in paginated_folders]
            logger.debug(f"Folder IDs for user {current_user.id}: {folder_ids}")
            return paginated_folders
        except Exception as e:
            logger.error(f"Error getting folders: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список папок"
            )
    
    @app.get("/folders/{folder_id}", response_model=FolderPublic)
    def get_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")], 
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить папку по ID"""
        try:
            return verify_folder_access(folder_id, current_user)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить папку"
            )
    
    @app.put("/folders/{folder_id}", response_model=FolderPublic)
    def update_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        folder: FolderUpdate,
        current_user: User = Depends(get_current_active_user)
    ):
        """Обновить папку"""
        try:
            existing_folder = verify_folder_access(folder_id, current_user)  # Проверяем доступ перед обновлением
            
            # Логируем данные обновления для отладки
            update_data = folder.model_dump(exclude_unset=True)
            logger.debug(f"Updating folder {folder_id} with data: {update_data}")
            
            # Для системных папок ограничиваем обновление - нельзя менять тип и некоторые системные поля
            if existing_folder.folder_type == "system":
                # Разрешаем обновление только определенных полей для системных папок
                # Нельзя менять folder_type, name (для системных папок), и другие критичные поля
                if "folder_type" in update_data:
                    update_data.pop("folder_type")
                # Можно менять description, icon, color, sort_order, но не name (для системных)
                if "name" in update_data:
                    # Имя системной папки менять нельзя - это нарушит логику работы
                    update_data.pop("name")
                
                # Создаем новый объект FolderUpdate только с разрешенными полями
                from models.folder import FolderUpdate
                allowed_update = FolderUpdate(**update_data)
                folder = allowed_update
            
            updated_folder = folder_service.update_folder(folder_id, folder, current_user.id)
            if not updated_folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder not found"
                )
            
            logger.info(f"Folder updated: id={folder_id} by user {current_user.id}")
            return updated_folder
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить папку"
            )
    
    @app.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить папку"""
        try:
            folder = verify_folder_access(folder_id, current_user)  # Проверяем доступ перед удалением
            
            # Запрещаем удаление системных папок
            if folder.folder_type == "system":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Системные папки нельзя удалить"
                )
            
            try:
                success = folder_service.delete_folder(folder_id, current_user.id)
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Folder not found"
                    )
                
                logger.info(f"Folder deleted: id={folder_id} by user {current_user.id}")
                return None
            except ValueError as e:
                # Обрабатываем ошибку удаления системной папки
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e)
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить папку"
            )
    
    @app.post("/folders/{folder_id}/chats/{chat_id}")
    def add_chat_to_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        chat_id: Annotated[int, Path(ge=1, description="ID чата")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Добавить чат в папку"""
        try:
            verify_folder_access(folder_id, current_user)
            
            success = folder_service.add_chat_to_folder(folder_id, chat_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder or chat not found"
                )
            
            logger.info(f"Chat {chat_id} added to folder {folder_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error adding chat {chat_id} to folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось добавить чат в папку"
            )
    
    @app.delete("/folders/{folder_id}/chats/{chat_id}")
    def remove_chat_from_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        chat_id: Annotated[int, Path(ge=1, description="ID чата")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить чат из папки"""
        try:
            verify_folder_access(folder_id, current_user)
            
            success = folder_service.remove_chat_from_folder(folder_id, chat_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder or chat not found"
                )
            
            logger.info(f"Chat {chat_id} removed from folder {folder_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error removing chat {chat_id} from folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить чат из папки"
            )
    
    @app.post("/folders/{folder_id}/agents/{agent_id}")
    def add_agent_to_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        agent_id: Annotated[int, Path(ge=1, description="ID агента")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Добавить агента в папку"""
        try:
            verify_folder_access(folder_id, current_user)
            
            success = folder_service.add_agent_to_folder(folder_id, agent_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder or agent not found"
                )
            
            logger.info(f"Agent {agent_id} added to folder {folder_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error adding agent {agent_id} to folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось добавить агента в папку"
            )
    
    @app.delete("/folders/{folder_id}/agents/{agent_id}")
    def remove_agent_from_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        agent_id: Annotated[int, Path(ge=1, description="ID агента")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Удалить агента из папки"""
        try:
            verify_folder_access(folder_id, current_user)
            
            success = folder_service.remove_agent_from_folder(folder_id, agent_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder or agent not found"
                )
            
            logger.info(f"Agent {agent_id} removed from folder {folder_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error removing agent {agent_id} from folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить агента из папки"
            )
    
    @app.post("/folders/{folder_id}/chats/{chat_id}/pin")
    def pin_chat_in_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        chat_id: Annotated[int, Path(ge=1, description="ID чата")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Закрепить чат в папке"""
        logger.info(f"Pin request: folder_id={folder_id}, chat_id={chat_id}, user_id={current_user.id}, username={current_user.username}")
        try:
            # Проверяем доступ к папке
            logger.debug(f"Verifying folder access for user {current_user.id}")
            folder = verify_folder_access(folder_id, current_user)
            logger.debug(f"Folder access verified: folder_id={folder_id}, user_id={folder.user_id}")
            
            # Проверяем, что папка принадлежит пользователю (дополнительная проверка)
            if folder.user_id != current_user.id:
                logger.warning(f"User {current_user.id} ({current_user.username}) attempted to access folder {folder_id} belonging to user {folder.user_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this folder"
                )
            
            # Закрепляем чат
            logger.debug(f"Attempting to pin chat {chat_id} in folder {folder_id} for user {current_user.id}")
            success = folder_service.pin_chat_in_folder(folder_id, chat_id, current_user.id)
            if not success:
                logger.warning(f"pin_chat_in_folder returned False for folder {folder_id}, chat {chat_id}, user {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Не удалось закрепить чат. Убедитесь, что чат существует и доступен."
                )
            
            logger.info(f"Chat {chat_id} pinned in folder {folder_id} by user {current_user.id} ({current_user.username})")
            return {"ok": True}
        except HTTPException as he:
            logger.warning(f"HTTPException in pin_chat_in_folder: status={he.status_code}, detail={he.detail}")
            raise
        except Exception as e:
            logger.error(f"Error pinning chat {chat_id} in folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось закрепить чат в папке: {str(e)}"
            )
    
    @app.delete("/folders/{folder_id}/chats/{chat_id}/pin")
    def unpin_chat_from_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        chat_id: Annotated[int, Path(ge=1, description="ID чата")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Открепить чат от папки"""
        try:
            verify_folder_access(folder_id, current_user)
            
            success = folder_service.unpin_chat_from_folder(folder_id, chat_id, current_user.id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Folder or chat not found"
                )
            
            logger.info(f"Chat {chat_id} unpinned from folder {folder_id} by user {current_user.id}")
            return {"ok": True}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error unpinning chat {chat_id} from folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось открепить чат от папки"
            )
    
    @app.get("/folders/{folder_id}/pinned-chats")
    def get_pinned_chats_in_folder(
        folder_id: Annotated[int, Path(ge=1, description="ID папки")],
        current_user: User = Depends(get_current_active_user)
    ):
        """Получить список закрепленных чатов в папке"""
        logger.info(f"GET pinned-chats request: folder_id={folder_id}, user_id={current_user.id}, username={current_user.username}")
        try:
            # Проверяем доступ к папке
            logger.debug(f"Verifying folder access for user {current_user.id}")
            folder = verify_folder_access(folder_id, current_user)
            logger.debug(f"Folder access verified: folder_id={folder_id}, folder_user_id={folder.user_id}, current_user_id={current_user.id}")
            
            # Проверяем, что папка принадлежит пользователю (дополнительная проверка)
            if folder.user_id != current_user.id:
                logger.warning(f"User {current_user.id} ({current_user.email}) attempted to access folder {folder_id} belonging to user {folder.user_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this folder"
                )
            
            pinned_chat_ids = folder_service.get_pinned_chats_in_folder(folder_id, current_user.id)
            
            logger.info(f"Retrieved {len(pinned_chat_ids)} pinned chats from folder {folder_id} for user {current_user.id} ({current_user.username})")
            return {"pinned_chats": pinned_chat_ids}
        except HTTPException as he:
            logger.warning(f"HTTPException in get_pinned_chats_in_folder: status={he.status_code}, detail={he.detail}, folder_id={folder_id}, user_id={current_user.id}")
            raise
        except Exception as e:
            logger.error(f"Error getting pinned chats from folder {folder_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось получить список закрепленных чатов: {str(e)}"
            )
