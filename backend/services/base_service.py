from typing import Generator
from sqlmodel import Session
from core.database import engine
import logging

logger = logging.getLogger(__name__)


class BaseService:
    """Базовый сервис с общими методами для работы с базой данных
    
    Предоставляет базовые методы для всех сервисов:
    - Получение сессии БД PostgreSQL
    """
    
    def __init__(self):
        """Инициализация базового сервиса"""
        self.engine = engine
    
    def get_session(self) -> Session:
        """Получить сессию базы данных PostgreSQL
        
        Returns:
            Сессия базы данных с настроенными параметрами
            
        Note:
            Сессия должна быть закрыта после использования.
            Рекомендуется использовать в контексте `with`:
            ```python
            with self.get_session() as session:
                # работа с сессией
            ```
        """
        session = Session(self.engine)
        return session
