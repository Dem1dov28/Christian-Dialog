from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional, Dict, Any
import json


class FolderBase(SQLModel):
    """Базовая модель папки"""
    name: str = Field(..., index=True, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    folder_type: str = Field(default="custom", description="Тип папки: custom, system")
    icon: Optional[str] = Field(default="folder", description="Иконка папки")
    color: Optional[str] = Field(default="bg-blue-500", description="Цвет папки")
    is_shared: bool = Field(default=False, description="Поделена ли папка")
    is_pinned: bool = Field(default=False, description="Закреплена ли папка")
    sort_order: int = Field(default=0, description="Порядок сортировки")
    
    # JSON поля для хранения ID чатов и агентов
    chat_ids: Optional[str] = Field(default="[]", description="JSON массив ID чатов")
    agent_ids: Optional[str] = Field(default="[]", description="JSON массив ID агентов")
    
    # Метаданные
    settings: Optional[str] = Field(default="{}", description="JSON настройки папки")


class Folder(FolderBase, table=True):
    """Модель папки в базе данных"""
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(..., foreign_key="user.id", description="ID пользователя-владельца")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Связи
    user: Optional["User"] = Relationship(back_populates="folders")
    
    def get_chat_ids(self) -> List[int]:
        """Получить список ID чатов"""
        try:
            return json.loads(self.chat_ids) if self.chat_ids else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_chat_ids(self, chat_ids: List[int]) -> None:
        """Установить список ID чатов"""
        self.chat_ids = json.dumps(chat_ids)
    
    def get_agent_ids(self) -> List[int]:
        """Получить список ID агентов"""
        try:
            return json.loads(self.agent_ids) if self.agent_ids else []
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_agent_ids(self, agent_ids: List[int]) -> None:
        """Установить список ID агентов"""
        self.agent_ids = json.dumps(agent_ids)
    
    def get_settings(self) -> Dict[str, Any]:
        """Получить настройки папки"""
        try:
            return json.loads(self.settings) if self.settings else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_settings(self, settings: Dict[str, Any]) -> None:
        """Установить настройки папки"""
        self.settings = json.dumps(settings)
    
    def get_pinned_chat_ids(self) -> List[int]:
        """Получить список ID закрепленных чатов"""
        try:
            settings = self.get_settings()
            return settings.get("pinned_chat_ids", [])
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_pinned_chat_ids(self, pinned_chat_ids: List[int]) -> None:
        """Установить список ID закрепленных чатов"""
        settings = self.get_settings()
        settings["pinned_chat_ids"] = pinned_chat_ids
        self.set_settings(settings)
    
    def add_pinned_chat(self, chat_id: int) -> bool:
        """Добавить чат в закрепленные (в начало списка)"""
        pinned = self.get_pinned_chat_ids()
        if chat_id not in pinned:
            # Добавляем в начало списка, чтобы новый закрепленный чат был выше всех остальных
            pinned = [chat_id] + pinned
            self.set_pinned_chat_ids(pinned)
            return True
        return False
    
    def remove_pinned_chat(self, chat_id: int) -> bool:
        """Удалить чат из закрепленных"""
        pinned = self.get_pinned_chat_ids()
        if chat_id in pinned:
            pinned.remove(chat_id)
            self.set_pinned_chat_ids(pinned)
            return True
        return False
    
    def toggle_pinned_chat(self, chat_id: int) -> bool:
        """Переключить состояние закрепления чата"""
        if self.is_pinned_chat(chat_id):
            return self.remove_pinned_chat(chat_id)
        else:
            return self.add_pinned_chat(chat_id)
    
    def is_pinned_chat(self, chat_id: int) -> bool:
        """Проверить, закреплен ли чат"""
        return chat_id in self.get_pinned_chat_ids()


class FolderPublic(FolderBase):
    """Публичная модель папки для API"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    chat_count: int = Field(default=0, description="Количество чатов в папке")
    chat_ids: Optional[List[int]] = Field(default_factory=list, description="Список ID чатов в папке")
    agent_ids: Optional[List[int]] = Field(default_factory=list, description="Список ID агентов в папке")
    pinned_chat_ids: Optional[List[int]] = Field(default_factory=list, description="Список ID закрепленных чатов в папке")


class FolderCreate(FolderBase):
    """Модель для создания пользовательской папки
    
    Примечание: Системные папки создаются автоматически и не могут быть созданы вручную через API.
    """
    chat_ids: Optional[List[int]] = Field(default_factory=list)
    agent_ids: Optional[List[int]] = Field(default_factory=list)
    pinned_chat_ids: Optional[List[int]] = Field(default_factory=list)
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict)


class FolderUpdate(SQLModel):
    """Модель для обновления папки"""
    name: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    icon: Optional[str] = Field(default=None)
    color: Optional[str] = Field(default=None)
    is_shared: Optional[bool] = Field(default=None)
    is_pinned: Optional[bool] = Field(default=None)
    sort_order: Optional[int] = Field(default=None)
    chat_ids: Optional[List[int]] = Field(default=None)
    agent_ids: Optional[List[int]] = Field(default=None)
    settings: Optional[Dict[str, Any]] = Field(default=None)
