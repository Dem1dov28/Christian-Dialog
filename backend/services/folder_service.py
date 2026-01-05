from typing import List, Optional, Dict, Any
from sqlmodel import Session, select, and_
from datetime import datetime
import logging

from models.folder import Folder, FolderPublic, FolderCreate, FolderUpdate
from services.base_service import BaseService

logger = logging.getLogger(__name__)


class FolderService(BaseService):
    """Сервис для работы с папками"""

    SYSTEM_FOLDER_DEFINITIONS = {
        "all_chats": {
            "name": "Все чаты",
            "description": "Все ваши чаты",
            "icon": "chat",
            "color": "bg-blue-500",
            "is_pinned": True,
            "sort_order": 0,
            "aliases": {"все чаты", "all chats", "чаты", "chats"},
            "populate": {"method": "_populate_all_chats_folder", "needs_user": True},
        },
        "characters": {
            "name": "Персонажи",
            "description": "Чаты с персонажами",
            "icon": "psychology",
            "color": "bg-purple-500",
            "is_pinned": True,
            "sort_order": 1,
            "aliases": {"персонажи", "characters", "агенты", "agents"},
            "populate": {"method": "_populate_characters_folder", "needs_user": True},
        },
    }

    def _normalize_system_folder_name(self, name: Optional[str]) -> str:
        return (name or "").strip().lower()

    def _get_system_folder_key(self, name: Optional[str]) -> Optional[str]:
        normalized = self._normalize_system_folder_name(name)
        for key, config in self.SYSTEM_FOLDER_DEFINITIONS.items():
            if normalized in config["aliases"]:
                return key
        return None

    def _build_system_folder(self, key: str, user_id: int) -> Folder:
        config = self.SYSTEM_FOLDER_DEFINITIONS[key]
        return Folder(
            name=config["name"],
            description=config["description"],
            folder_type="system",
            icon=config["icon"],
            color=config["color"],
            is_pinned=config["is_pinned"],
            sort_order=config["sort_order"],
            user_id=user_id,
            chat_ids="[]",
            agent_ids="[]",
            settings="{}",
        )

    def _update_system_folder_metadata(self, folder: Folder, key: str) -> bool:
        config = self.SYSTEM_FOLDER_DEFINITIONS[key]
        updated = False

        if folder.folder_type != "system":
            folder.folder_type = "system"
            updated = True

        if folder.icon != config["icon"]:
            folder.icon = config["icon"]
            updated = True

        if folder.color != config["color"]:
            folder.color = config["color"]
            updated = True

        if folder.is_pinned != config["is_pinned"]:
            folder.is_pinned = config["is_pinned"]
            updated = True

        if folder.sort_order != config["sort_order"]:
            folder.sort_order = config["sort_order"]
            updated = True

        if folder.description != config["description"]:
            folder.description = config["description"]
            updated = True

        if updated:
            folder.updated_at = datetime.utcnow()

        return updated
    
    def create_folder(self, folder_data: FolderCreate, user_id: int) -> FolderPublic:
        """Создать новую папку
        
        Args:
            folder_data: Данные для создания папки
            user_id: ID пользователя
            
        Returns:
            Созданная папка
            
        Raises:
            Exception: При ошибке создания папки
            ValueError: Если попытка создать системную папку через этот метод
        """
        try:
            # Запрещаем создание системных папок через этот метод
            # Системные папки создаются только через create_system_folders
            if folder_data.folder_type == "system":
                raise ValueError("Системные папки нельзя создавать вручную. Используйте create_system_folders.")
            
            with self.get_session() as session:
                # Устанавливаем folder_type="custom" по умолчанию, если не указан
                folder_type = folder_data.folder_type or "custom"
                if folder_type == "system":
                    raise ValueError("Системные папки нельзя создавать вручную")
                
                # Создаем папку
                db_folder = Folder(
                    name=folder_data.name,
                    description=folder_data.description,
                    folder_type=folder_type,
                    icon=folder_data.icon,
                    color=folder_data.color,
                    is_shared=folder_data.is_shared,
                    is_pinned=folder_data.is_pinned,
                    sort_order=folder_data.sort_order,
                    user_id=user_id
                )
                
                # Устанавливаем JSON поля
                if folder_data.chat_ids:
                    db_folder.set_chat_ids(folder_data.chat_ids)
                else:
                    db_folder.set_chat_ids([])
                
                if folder_data.agent_ids:
                    db_folder.set_agent_ids(folder_data.agent_ids)
                else:
                    db_folder.set_agent_ids([])
                
                # Инициализируем settings, если не указаны
                if folder_data.settings:
                    db_folder.set_settings(folder_data.settings)
                else:
                    # Убеждаемся, что settings инициализированы с пустым словарем
                    db_folder.set_settings({})
                
                # Устанавливаем закрепленные чаты после инициализации settings
                if folder_data.pinned_chat_ids:
                    db_folder.set_pinned_chat_ids(folder_data.pinned_chat_ids)
                
                session.add(db_folder)
                session.commit()
                session.refresh(db_folder)
                
                logger.info(f"Created folder {db_folder.id} '{db_folder.name}' for user {user_id}")
                # Возвращаем публичную модель с подсчетом чатов
                return self._convert_to_public(db_folder, session)
        except Exception as e:
            logger.error(f"Error creating folder for user {user_id}: {e}", exc_info=True)
            raise
    
    def get_folder(self, folder_id: int, user_id: int) -> Optional[FolderPublic]:
        """Получить папку по ID"""
        logger.debug(f"Getting folder {folder_id} for user {user_id}")
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                # Проверяем, существует ли папка вообще (для диагностики)
                folder_exists = session.get(Folder, folder_id)
                if folder_exists:
                    logger.warning(
                        f"Folder {folder_id} exists but belongs to user {folder_exists.user_id}, "
                        f"not {user_id} (requested folder: {folder_exists.name})"
                    )
                else:
                    logger.warning(f"Folder {folder_id} does not exist at all")
                return None
            
            logger.debug(f"Found folder {folder_id} '{folder.name}' for user {user_id}")
            return self._convert_to_public(folder, session)
    
    def get_folders(self, user_id: int, folder_type: Optional[str] = None) -> List[FolderPublic]:
        """Получить все папки пользователя"""
        with self.get_session() as session:
            query = select(Folder).where(Folder.user_id == user_id)
            
            if folder_type:
                query = query.where(Folder.folder_type == folder_type)
            
            query = query.order_by(Folder.sort_order, Folder.created_at.desc())
            folders = session.exec(query).all()
            
            return [self._convert_to_public(folder, session) for folder in folders]
    
    def update_folder(self, folder_id: int, folder_data: FolderUpdate, user_id: int) -> Optional[FolderPublic]:
        """Обновить папку"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return None
            
            # Обновляем поля
            update_data = folder_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field in ['chat_ids', 'agent_ids', 'pinned_chat_ids', 'settings']:
                    # Обрабатываем JSON поля
                    if field == 'chat_ids' and value is not None:
                        folder.set_chat_ids(value)
                    elif field == 'agent_ids' and value is not None:
                        folder.set_agent_ids(value)
                    elif field == 'pinned_chat_ids' and value is not None:
                        folder.set_pinned_chat_ids(value)
                    elif field == 'settings' and value is not None:
                        folder.set_settings(value)
                else:
                    setattr(folder, field, value)
            
            folder.updated_at = datetime.utcnow()
            session.add(folder)
            session.commit()
            session.refresh(folder)
            
            return self._convert_to_public(folder, session)
    
    def delete_folder(self, folder_id: int, user_id: int) -> bool:
        """Удалить папку
        
        Args:
            folder_id: ID папки
            user_id: ID пользователя
            
        Returns:
            True, если папка успешно удалена, False если не найдена
            
        Raises:
            ValueError: Если попытка удалить системную папку
        """
        try:
            with self.get_session() as session:
                folder = session.exec(
                    select(Folder).where(
                        and_(Folder.id == folder_id, Folder.user_id == user_id)
                    )
                ).first()
                
                if not folder:
                    logger.warning(f"Folder {folder_id} not found for user {user_id}")
                    return False
                
                # Запрещаем удаление системных папок
                if folder.folder_type == "system":
                    logger.warning(f"Attempt to delete system folder {folder_id} by user {user_id}")
                    raise ValueError("Системные папки нельзя удалить")
                
                session.delete(folder)
                session.commit()
                logger.info(f"Deleted folder {folder_id} for user {user_id}")
                return True
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error deleting folder {folder_id} for user {user_id}: {e}", exc_info=True)
            return False
    
    def add_chat_to_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Добавить чат в папку"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return False
            
            chat_ids = folder.get_chat_ids()
            if chat_id not in chat_ids:
                chat_ids.append(chat_id)
                folder.set_chat_ids(chat_ids)
                folder.updated_at = datetime.utcnow()
                session.add(folder)
                session.commit()
            
            return True
    
    def remove_chat_from_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Удалить чат из папки"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return False
            
            chat_ids = folder.get_chat_ids()
            if chat_id in chat_ids:
                chat_ids.remove(chat_id)
                folder.set_chat_ids(chat_ids)
                folder.updated_at = datetime.utcnow()
                session.add(folder)
                session.commit()
            
            return True
    
    def add_agent_to_folder(self, folder_id: int, agent_id: int, user_id: int) -> bool:
        """Добавить агента в папку"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return False
            
            agent_ids = folder.get_agent_ids()
            if agent_id not in agent_ids:
                agent_ids.append(agent_id)
                folder.set_agent_ids(agent_ids)
                folder.updated_at = datetime.utcnow()
                session.add(folder)
                session.commit()
            
            return True
    
    def remove_agent_from_folder(self, folder_id: int, agent_id: int, user_id: int) -> bool:
        """Удалить агента из папки"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return False
            
            agent_ids = folder.get_agent_ids()
            if agent_id in agent_ids:
                agent_ids.remove(agent_id)
                folder.set_agent_ids(agent_ids)
                folder.updated_at = datetime.utcnow()
                session.add(folder)
                session.commit()
            
            return True

    # --- helpers for system folders ---
    def add_chat_to_system_folder_by_name(
        self, user_id: int, folder_name: str, chat_id: int, session: Session | None = None
    ) -> bool:
        """Добавить чат в системную папку по имени (например, 'Персонажи')."""
        if session is None:
            with self.get_session() as local_session:
                return self._add_chat_to_system_folder_by_name(local_session, user_id, folder_name, chat_id, auto_commit=True)
        else:
            return self._add_chat_to_system_folder_by_name(session, user_id, folder_name, chat_id, auto_commit=False)

    def _add_chat_to_system_folder_by_name(self, session: Session, user_id: int, folder_name: str, chat_id: int, auto_commit: bool = False) -> bool:
        # Гарантируем, что системные папки есть
        self._ensure_system_folders_exist(user_id, session)
        folder = session.exec(
            select(Folder).where(
                and_(Folder.user_id == user_id, Folder.folder_type == "system", Folder.name == folder_name)
            )
        ).first()
        if not folder:
            return False
        chat_ids = folder.get_chat_ids()
        if chat_id not in chat_ids:
            chat_ids.insert(0, chat_id)  # В начало
            folder.set_chat_ids(chat_ids)
            folder.updated_at = datetime.utcnow()
            session.add(folder)
            if auto_commit:
                session.commit()
        return True
    
    def pin_chat_in_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Закрепить чат в папке
        
        Args:
            folder_id: ID папки
            chat_id: ID чата
            user_id: ID пользователя
            
        Returns:
            True, если чат успешно закреплен, False если папка, чат не найдены или чат не в папке
        """
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                logger.warning(f"Folder {folder_id} not found for user {user_id}")
                return False
            
            # Убеждаемся, что settings инициализированы
            if not folder.settings or folder.settings == "":
                folder.set_settings({})
            
            # Проверяем, что чат есть в папке
            chat_ids = folder.get_chat_ids()
            if chat_id not in chat_ids:
                logger.debug(f"Chat {chat_id} not found in folder {folder_id} (chat_ids: {chat_ids})")
                # Для пользовательских папок автоматически добавляем чат, если его нет
                # Это позволяет закреплять чат даже если он еще не был явно добавлен в папку
                if folder.folder_type == "custom":
                    chat_ids.append(chat_id)
                    folder.set_chat_ids(chat_ids)
                    logger.info(f"Auto-added chat {chat_id} to custom folder {folder_id} during pin")
                else:
                    return False
            
            # Закрепляем чат
            try:
                success = folder.add_pinned_chat(chat_id)
                if success:
                    folder.updated_at = datetime.utcnow()
                    session.add(folder)
                    session.commit()
                    logger.info(f"Chat {chat_id} pinned in folder {folder_id} for user {user_id}")
                else:
                    logger.debug(f"Chat {chat_id} already pinned in folder {folder_id}")
                    # Если чат уже закреплен, это тоже успех
                    success = True
                return success
            except Exception as e:
                logger.error(f"Error pinning chat {chat_id} in folder {folder_id}: {e}", exc_info=True)
                return False
    
    def unpin_chat_from_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Открепить чат от папки
        
        Args:
            folder_id: ID папки
            chat_id: ID чата
            user_id: ID пользователя
            
        Returns:
            True, если чат успешно откреплен, False если папка не найдена или чат не был закреплен
        """
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                logger.warning(f"Folder {folder_id} not found for user {user_id}")
                return False
            
            # Убеждаемся, что settings инициализированы
            if not folder.settings or folder.settings == "":
                folder.set_settings({})
            
            # Открепляем чат
            try:
                success = folder.remove_pinned_chat(chat_id)
                if success:
                    folder.updated_at = datetime.utcnow()
                    session.add(folder)
                    session.commit()
                    logger.info(f"Chat {chat_id} unpinned from folder {folder_id} for user {user_id}")
                else:
                    logger.debug(f"Chat {chat_id} was not pinned in folder {folder_id}")
                return success
            except Exception as e:
                logger.error(f"Error unpinning chat {chat_id} from folder {folder_id}: {e}", exc_info=True)
                return False
    
    def toggle_pin_chat_in_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Переключить состояние закрепления чата в папке"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return False
            
            # Проверяем, что чат есть в папке
            chat_ids = folder.get_chat_ids()
            if chat_id not in chat_ids:
                return False
            
            # Переключаем состояние закрепления
            success = folder.toggle_pinned_chat(chat_id)
            if success:
                folder.updated_at = datetime.utcnow()
                session.add(folder)
                session.commit()
            
            return success
    
    def get_pinned_chats_in_folder(self, folder_id: int, user_id: int) -> List[int]:
        """Получить список закрепленных чатов в папке"""
        with self.get_session() as session:
            folder = session.exec(
                select(Folder).where(
                    and_(Folder.id == folder_id, Folder.user_id == user_id)
                )
            ).first()
            
            if not folder:
                return []
            
            return folder.get_pinned_chat_ids()
    
    def _populate_all_chats_folder(self, folder: Folder, user_id: int, session: Session) -> None:
        """Заполнить папку 'Все чаты' всеми чатами пользователя"""
        # Получаем все чаты пользователя
        from models.conversation import Conversation
        from models.multi_agent_conversation import MultiAgentConversation
        
        # Обычные чаты
        conversations = session.exec(
            select(Conversation).where(Conversation.user_id == user_id)
        ).all()
        
        # Групповые чаты
        multi_conversations = session.exec(
            select(MultiAgentConversation).where(MultiAgentConversation.user_id == user_id)
        ).all()
        
        # Собираем все ID чатов
        all_chat_ids = []
        for conv in conversations:
            all_chat_ids.append(conv.id)
        for conv in multi_conversations:
            all_chat_ids.append(conv.id)
        
        # Сортируем по времени последнего обновления (новые сверху)
        all_chat_ids.sort(key=lambda chat_id: self._get_chat_updated_at(chat_id, session), reverse=True)
        
        # Обновляем папку
        folder.set_chat_ids(all_chat_ids)
        folder.updated_at = datetime.utcnow()
        session.add(folder)
        
        logger.debug(f"Заполнена папка 'Все чаты' {len(all_chat_ids)} чатами")
    
    def _populate_characters_folder(self, folder: Folder, user_id: int, session: Session) -> None:
        """Заполнить папку 'Персонажи' всеми чатами с агентами"""
        # Получаем все чаты пользователя с агентами
        from models.conversation import Conversation
        from models.multi_agent_conversation import MultiAgentConversation
        
        # Обычные чаты с агентами
        conversations = session.exec(
            select(Conversation).where(Conversation.user_id == user_id)
        ).all()
        
        # Групповые чаты (они тоже с агентами)
        multi_conversations = session.exec(
            select(MultiAgentConversation).where(MultiAgentConversation.user_id == user_id)
        ).all()
        
        # Собираем все ID чатов с агентами
        all_chat_ids = []
        for conv in conversations:
            all_chat_ids.append(conv.id)
        for conv in multi_conversations:
            all_chat_ids.append(conv.id)
        
        # Сортируем по времени последнего обновления (новые сверху)
        all_chat_ids.sort(key=lambda chat_id: self._get_chat_updated_at(chat_id, session), reverse=True)
        
        # Обновляем папку
        folder.set_chat_ids(all_chat_ids)
        folder.updated_at = datetime.utcnow()
        session.add(folder)
        
        logger.debug(f"Заполнена папка 'Персонажи' {len(all_chat_ids)} чатами")
    
    def _get_chat_updated_at(self, chat_id: int, session: Session) -> datetime:
        """Получить время последнего обновления чата"""
        from models.conversation import Conversation
        from models.multi_agent_conversation import MultiAgentConversation
        
        # Пробуем найти обычный чат
        conversation = session.get(Conversation, chat_id)
        if conversation:
            return conversation.updated_at
        
        # Пробуем найти групповой чат
        multi_conversation = session.get(MultiAgentConversation, chat_id)
        if multi_conversation:
            return multi_conversation.updated_at
        
        # Если не найден, возвращаем минимальную дату
        return datetime.min
    
    def move_chat_to_top_in_all_folders(self, chat_id: int, user_id: int, session: Session = None) -> bool:
        """Переместить чат на первое место во всех папках пользователя, где он присутствует или должен присутствовать"""
        if session is None:
            with self.get_session() as session:
                result = self._move_chat_to_top_in_all_folders(chat_id, user_id, session)
                session.commit()
                return result
        else:
            return self._move_chat_to_top_in_all_folders(chat_id, user_id, session)
    
    def _move_chat_to_top_in_all_folders(self, chat_id: int, user_id: int, session: Session) -> bool:
        """Внутренний метод для перемещения чата на первое место во всех папках"""
        # Убеждаемся, что системные папки существуют и заполнены
        self._ensure_system_folders_exist(user_id, session)
        
        # Получаем все папки пользователя
        folders = session.exec(
            select(Folder).where(Folder.user_id == user_id)
        ).all()
        
        # Принудительно обновляем системные папки
        for folder in folders:
            if folder.folder_type == "system":
                folder_key = self._get_system_folder_key(folder.name)
                if folder_key == "all_chats":
                    self._populate_all_chats_folder(folder, user_id, session)
                elif folder_key == "characters":
                    self._populate_characters_folder(folder, user_id, session)
        
        updated_folders = []
        
        for folder in folders:
            chat_ids = folder.get_chat_ids()
            agent_ids = folder.get_agent_ids()
            
            # Получаем информацию о чате для определения агента
            from models.conversation import Conversation
            from models.multi_agent_conversation import MultiAgentConversation
            
            conversation = session.get(Conversation, chat_id)
            multi_conversation = None
            
            if not conversation:
                # Пробуем найти групповой чат
                multi_conversation = session.get(MultiAgentConversation, chat_id)
                if not multi_conversation:
                    continue
            else:
                # Это обычный чат
                pass
            
            should_be_in_folder = False
            
            # Проверяем, должен ли чат быть в этой папке
            if folder.folder_type == "system":
                folder_key = self._get_system_folder_key(folder.name)
                if folder_key == "all_chats":
                    # Системная папка "Все чаты" - добавляем все чаты (обычные и групповые)
                    should_be_in_folder = True
                elif folder_key == "characters":
                    # Системная папка "Персонажи" - добавляем все чаты с агентами
                    should_be_in_folder = True
                elif agent_ids and conversation and conversation.agent_id in agent_ids:
                    # Системная папка с конкретными агентами (только для обычных чатов)
                    should_be_in_folder = True
                elif chat_id in chat_ids:
                    # Системная папка, где чат уже присутствует (резервный случай)
                    should_be_in_folder = True
            else:
                # Пользовательские папки - проверяем только по chat_ids
                should_be_in_folder = chat_id in chat_ids
            
            if should_be_in_folder:
                # Если чат еще не в папке, добавляем его
                if chat_id not in chat_ids:
                    chat_ids.append(chat_id)
                    logger.debug(f"Добавлен чат {chat_id} в папку '{folder.name}' (ID: {folder.id})")
                
                # Перемещаем чат на первое место
                chat_ids.remove(chat_id)
                chat_ids.insert(0, chat_id)
                logger.debug(f"Перемещен чат {chat_id} на первое место в папке '{folder.name}' (ID: {folder.id})")
                
                # Обновляем папку
                folder.set_chat_ids(chat_ids)
                folder.updated_at = datetime.utcnow()
                updated_folders.append(folder)
        
        # Сохраняем все изменения
        if updated_folders:
            for folder in updated_folders:
                session.add(folder)
            return True
        
        return False

    def create_system_folders(self, user_id: int) -> bool:
        """Создать системные папки для пользователя по запросу"""
        with self.get_session() as session:
            return self._create_system_folders(user_id, session)
    
    def _create_system_folders(self, user_id: int, session: Session) -> bool:
        """Внутренний метод для создания/синхронизации системных папок"""
        existing_folders = session.exec(
            select(Folder).where(
                and_(
                    Folder.user_id == user_id,
                    Folder.folder_type == "system"
                )
            )
        ).all()

        existing_by_key: Dict[str, Folder] = {}
        for folder in existing_folders:
            key = self._get_system_folder_key(folder.name)
            if key:
                existing_by_key[key] = folder

        ordered_definitions = sorted(
            self.SYSTEM_FOLDER_DEFINITIONS.items(),
            key=lambda item: item[1]["sort_order"]
        )

        for key, config in ordered_definitions:
            folder = existing_by_key.get(key)

            if not folder:
                folder = self._build_system_folder(key, user_id)
                session.add(folder)
                session.flush()
                existing_by_key[key] = folder
                logger.info(
                    "Создана системная папка '%s' для пользователя %s",
                    config["name"],
                    user_id,
                )
            else:
                if self._update_system_folder_metadata(folder, key):
                    session.add(folder)
                    logger.debug(
                        "Обновлены метаданные системной папки '%s' для пользователя %s",
                        folder.name,
                        user_id,
                    )

            populate_cfg = config.get("populate")
            if populate_cfg:
                method_name = populate_cfg.get("method")
                method = getattr(self, method_name, None)
                if method:
                    if populate_cfg.get("needs_user", False):
                        method(folder, user_id, session)
                    else:
                        method(folder, session)

        session.commit()
        return True

    def ensure_system_folders_exist(self, user_id: int) -> bool:
        """Убедиться, что у пользователя есть системные папки"""
        with self.get_session() as session:
            return self._ensure_system_folders_exist(user_id, session)
    
    def _ensure_system_folders_exist(self, user_id: int, session: Session) -> bool:
        """Внутренний метод для создания системных папок"""
        self._create_system_folders(user_id, session)
        return True

    def _convert_to_public(self, folder: Folder, session: Session) -> FolderPublic:
        """Конвертировать папку в публичную модель с подсчетом чатов"""
        # Получаем chat_ids и agent_ids
        chat_ids = folder.get_chat_ids()
        agent_ids = folder.get_agent_ids()
        
        # Подсчитываем количество чатов в папке
        chat_count = 0
        
        # Если есть chat_ids, считаем их
        if chat_ids:
            chat_count += len(chat_ids)
        
        # Если есть agent_ids, считаем чаты с этими агентами
        if agent_ids:
            # Здесь нужно будет добавить логику подсчета чатов по агентам
            # Пока оставляем как есть
            pass
        
        # Получаем закрепленные чаты
        pinned_chat_ids = folder.get_pinned_chat_ids()
        
        # Создаем публичную модель
        folder_dict = folder.model_dump()
        folder_dict['chat_count'] = chat_count
        folder_dict['chat_ids'] = chat_ids
        folder_dict['agent_ids'] = agent_ids
        folder_dict['pinned_chat_ids'] = pinned_chat_ids
        
        return FolderPublic.model_validate(folder_dict)

    def move_chat_to_top_in_folder(self, folder_id: int, chat_id: int, user_id: int) -> bool:
        """Переместить чат на первое место в папке
        
        Args:
            folder_id: ID папки
            chat_id: ID чата
            user_id: ID пользователя
            
        Returns:
            True, если чат успешно перемещен, False если папка или чат не найдены
        """
        try:
            with self.get_session() as session:
                folder = session.exec(
                    select(Folder).where(
                        and_(Folder.id == folder_id, Folder.user_id == user_id)
                    )
                ).first()
                
                if not folder:
                    logger.warning(f"Folder {folder_id} not found for user {user_id}")
                    return False
                
                chat_ids = folder.get_chat_ids()
                
                if chat_id in chat_ids:
                    # Перемещаем чат на первое место
                    chat_ids.remove(chat_id)
                    chat_ids.insert(0, chat_id)
                    folder.set_chat_ids(chat_ids)
                    folder.updated_at = datetime.utcnow()
                    session.add(folder)
                    session.commit()
                    
                    logger.debug(f"Moved chat {chat_id} to top in folder {folder_id}")
                    return True
                
                logger.debug(f"Chat {chat_id} not found in folder {folder_id}")
                return False
        except Exception as e:
            logger.error(f"Error moving chat {chat_id} to top in folder {folder_id}: {e}", exc_info=True)
            return False

