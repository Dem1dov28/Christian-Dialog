from typing import List, Optional
from sqlmodel import Session, select
import logging

from models.agent import Agent, AgentPublic
from services.base_service import BaseService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class UserAgentService(BaseService):
    """Сервис для работы с пользовательскими агентами (созданными персонажами)
    
    Этот сервис отвечает за управление персонажами, созданными пользователями.
    Он обрабатывает операции создания, чтения, обновления и удаления таких агентов,
    а также проверяет права доступа (только владелец может управлять своим агентом).
    """
    
    # Стандартная модель для всех созданных персонажей
    DEFAULT_MODEL = "openrouter/google/gemini-2.0-flash-001"
    DEFAULT_CATEGORY = "created"
    DEFAULT_TEMPERATURE = 0.7
    
    def __init__(self, agent_service=None):
        """Инициализация сервиса пользовательских агентов
        
        Args:
            agent_service: Ссылка на AgentService для синхронизации кэша активных агентов
        """
        super().__init__()
        self.agent_service = agent_service
    
    def get_user_agents(self, user_id: int) -> List[AgentPublic]:
        """Получить список персонажей, созданных пользователем
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Список персональных агентов пользователя
        """
        try:
            with self.get_session() as session:
                query = select(Agent).where(
                    Agent.user_id == user_id,
                    Agent.category == self.DEFAULT_CATEGORY,
                    (Agent.is_active == True) | (Agent.is_active.is_(None))  # noqa: E712
                )
                agents = session.exec(query).all()
                result = [AgentPublic.model_validate(agent) for agent in agents]
                logger.debug(f"Найдено {len(result)} персональных агентов для пользователя {user_id}")
                return result
        except Exception as e:
            logger.error(f"Ошибка при получении персональных агентов пользователя {user_id}: {e}", exc_info=True)
            return []
    
    def create_user_agent(
        self, 
        user_id: int, 
        name: str, 
        instructions: str,
        description: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> AgentPublic:
        """Создать нового пользовательского персонажа
        
        Args:
            user_id: ID пользователя-создателя
            name: Имя персонажа
            instructions: Промпт/инструкции для персонажа
            description: Описание персонажа
            avatar_url: URL аватара
            
        Returns:
            Созданный агент
            
        Raises:
            ValueError: Если данные агента некорректны
            Exception: При ошибке создания агента в БД
        """
        if not name or not name.strip():
            raise ValueError("Имя персонажа не может быть пустым")
        if not instructions or not instructions.strip():
            raise ValueError("Инструкции персонажа не могут быть пустыми")
        
        try:
            with self.get_session() as session:
                # Всегда используем стандартную модель (пользователь не может её выбрать)
                agent_model = self.DEFAULT_MODEL
                
                db_agent = Agent(
                    name=name.strip(),
                    instructions=instructions.strip(),
                    description=description.strip() if description else None,
                    model=agent_model,
                    category=self.DEFAULT_CATEGORY,
                    avatar_url=avatar_url,
                    user_id=user_id,
                    is_active=True,
                    temperature=self.DEFAULT_TEMPERATURE
                )
                session.add(db_agent)
                session.commit()
                session.refresh(db_agent)
                
                # Синхронизируем с кэшем активных агентов в AgentService
                if self.agent_service:
                    self.agent_service.active_agents[db_agent.id] = {
                        "name": db_agent.name,
                        "instructions": db_agent.instructions,
                        "model": db_agent.model,
                        "category": db_agent.category or ""
                    }
                
                logger.info(f"Создан персональный агент: {db_agent.name} (ID: {db_agent.id}) для пользователя {user_id}")
                return AgentPublic.model_validate(db_agent)
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Ошибка при создании персонального агента: {e}", exc_info=True)
            raise
    
    def get_user_agent(self, agent_id: int, user_id: int) -> Optional[AgentPublic]:
        """Получить пользовательского агента по ID с проверкой прав доступа
        
        Args:
            agent_id: ID агента
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            Агент, если найден и принадлежит пользователю, иначе None
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                
                if not agent:
                    return None
                
                # Проверяем, что это пользовательский агент и принадлежит указанному пользователю
                if agent.user_id != user_id or agent.category != self.DEFAULT_CATEGORY:
                    logger.warning(f"Попытка доступа к агенту {agent_id} пользователем {user_id}: права доступа отсутствуют")
                    return None
                
                return AgentPublic.model_validate(agent)
        except Exception as e:
            logger.error(f"Ошибка при получении пользовательского агента {agent_id}: {e}", exc_info=True)
            return None
    
    def update_user_agent(
        self,
        agent_id: int,
        user_id: int,
        name: Optional[str] = None,
        instructions: Optional[str] = None,
        description: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> Optional[AgentPublic]:
        """Обновить пользовательского агента
        
        Args:
            agent_id: ID агента
            user_id: ID пользователя (для проверки прав)
            name: Новое имя (опционально)
            instructions: Новые инструкции (опционально)
            description: Новое описание (опционально)
            avatar_url: Новый URL аватара (опционально)
            
        Returns:
            Обновленный агент или None, если не найден или нет прав доступа
            
        Raises:
            ValueError: Если все поля None (нечего обновлять)
        """
        # Проверяем, что есть хотя бы одно поле для обновления
        update_fields = {
            "name": name,
            "instructions": instructions,
            "description": description,
            "avatar_url": avatar_url
        }
        
        # Фильтруем None значения
        update_fields = {k: v for k, v in update_fields.items() if v is not None}
        
        if not update_fields:
            raise ValueError("Нет полей для обновления")
        
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                
                if not agent:
                    logger.warning(f"Попытка обновить несуществующего агента: {agent_id}")
                    return None
                
                # Проверяем права доступа
                if agent.user_id != user_id or agent.category != self.DEFAULT_CATEGORY:
                    logger.warning(f"Попытка обновить агента {agent_id} пользователем {user_id}: права доступа отсутствуют")
                    return None
                
                # Обновляем поля (модель не может быть изменена пользователем)
                for key, value in update_fields.items():
                    if key == "name" and value:
                        setattr(agent, key, value.strip())
                    elif key == "instructions" and value:
                        setattr(agent, key, value.strip())
                    elif key == "description":
                        setattr(agent, key, value.strip() if value else None)
                    else:
                        setattr(agent, key, value)
                
                # Гарантируем, что модель остается DEFAULT_MODEL (на случай, если кто-то попытался её изменить)
                agent.model = self.DEFAULT_MODEL
                
                # Обновляем кэш активных агентов в AgentService
                if self.agent_service and agent_id in self.agent_service.active_agents:
                    self.agent_service.active_agents[agent_id] = {
                        "name": agent.name,
                        "instructions": agent.instructions,
                        "model": agent.model,
                        "category": agent.category or ""
                    }
                
                session.add(agent)
                session.commit()
                session.refresh(agent)
                
                logger.info(f"Пользовательский агент {agent_id} обновлен пользователем {user_id}")
                return AgentPublic.model_validate(agent)
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Ошибка при обновлении пользовательского агента {agent_id}: {e}", exc_info=True)
            raise
    
    def delete_user_agent(self, agent_id: int, user_id: int) -> bool:
        """Удалить пользовательского агента
        
        Args:
            agent_id: ID агента
            user_id: ID пользователя (для проверки прав)
            
        Returns:
            True, если агент успешно удален, False если не найден или нет прав доступа
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                
                if not agent:
                    logger.warning(f"Попытка удалить несуществующего агента: {agent_id}")
                    return False
                
                # Проверяем права доступа
                if agent.user_id != user_id or agent.category != self.DEFAULT_CATEGORY:
                    logger.warning(f"Попытка удалить агента {agent_id} пользователем {user_id}: права доступа отсутствуют")
                    return False
                
                # Удаляем из кэша активных агентов
                if self.agent_service and agent_id in self.agent_service.active_agents:
                    del self.agent_service.active_agents[agent_id]
                
                # Деактивируем агента вместо физического удаления
                # Это позволяет сохранить историю чатов с этим персонажем
                agent.is_active = False
                session.add(agent)
                session.commit()
                
                logger.info(f"Пользовательский агент {agent_id} ({agent.name}) деактивирован пользователем {user_id}")
                return True
        except Exception as e:
            logger.error(f"Ошибка при удалении пользовательского агента {agent_id}: {e}", exc_info=True)
            return False
    
    def check_ownership(self, agent_id: int, user_id: int) -> bool:
        """Проверить, является ли пользователь владельцем агента
        
        Args:
            agent_id: ID агента
            user_id: ID пользователя
            
        Returns:
            True, если пользователь является владельцем агента
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                if not agent:
                    return False
                
                return agent.user_id == user_id and agent.category == self.DEFAULT_CATEGORY
        except Exception as e:
            logger.error(f"Ошибка при проверке прав владения агентом {agent_id}: {e}", exc_info=True)
            return False

