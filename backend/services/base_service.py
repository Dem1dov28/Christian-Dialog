from typing import Generator
from sqlmodel import Session
from core.database import engine
import logging

logger = logging.getLogger(__name__)


class BaseService:
    """Базовый сервис с общими методами для работы с базой данных
    
    Предоставляет базовые методы для всех сервисов:
    - Получение сессии БД с настройками WAL режима
    """
    
    def __init__(self):
        """Инициализация базового сервиса"""
        self.engine = engine
    
    def get_session(self) -> Session:
        """Получить сессию базы данных с WAL настройками
        
        Устанавливает:
        - WAL режим (Write-Ahead Logging) для параллельного доступа
        - busy_timeout для предотвращения блокировок
        
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
        
        # ✅ КРИТИЧНО: Устанавливаем WAL режим и busy_timeout для каждой сессии
        try:
            # Используем exec_driver_sql для PRAGMA команд
            session.exec_driver_sql("PRAGMA journal_mode=WAL")
            session.exec_driver_sql("PRAGMA busy_timeout=30000")
        except Exception as e:
            # Логируем, но не прерываем выполнение, если PRAGMA не поддерживается
            logger.debug(f"Не удалось установить PRAGMA настройки: {e}")
        
        return session
