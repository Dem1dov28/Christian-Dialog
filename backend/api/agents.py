from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status
import logging

from models.agent import AgentCreate, AgentPublic, AgentUpdate
from models.user import User
from core.dependencies import get_current_active_user
from services.agent_service import AgentService

logger = logging.getLogger(__name__)


def create_agent_endpoints(app, agent_service: AgentService):
    """Создать эндпоинты для агентов"""
    
    @app.post("/agents/", response_model=AgentPublic, status_code=status.HTTP_201_CREATED)
    def create_agent(agent: AgentCreate, current_user: User = Depends(get_current_active_user)):
        """Создать нового агента"""
        try:
            result = agent_service.create_agent(agent)
            logger.info(f"Agent created: id={result.id}, name={result.name} by user {current_user.id}")
            return result
        except Exception as e:
            logger.error(f"Error creating agent: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось создать агента: {str(e)}"
            )

    @app.get("/agents/", response_model=List[AgentPublic])
    def read_agents(
        current_user: User = Depends(get_current_active_user),
        offset: int = Query(0, ge=0, description="Смещение для пагинации"),
        limit: int = Query(100, le=100, ge=1, description="Количество записей"),
        category: Optional[str] = Query(None, description="Фильтр по категории"),
    ):
        """Получить список всех агентов"""
        try:
            # Оптимизация: фильтруем на уровне БД через сервис
            agents = agent_service.get_all_agents(category=category)
            
            # Применяем пагинацию
            paginated_agents = agents[offset:offset + limit]
            
            return paginated_agents
        except Exception as e:
            logger.error(f"Error getting agents: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список агентов"
            )

    @app.get("/agents/categories/")
    def get_agent_categories(current_user: User = Depends(get_current_active_user)):
        """Получить список всех категорий агентов"""
        try:
            # Оптимизация: получаем категории напрямую, без загрузки всех агентов
            categories = agent_service.get_all_categories()
            return {"categories": categories}
        except Exception as e:
            logger.error(f"Error getting categories: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список категорий"
            )

    @app.get("/agents/{agent_id}", response_model=AgentPublic)
    def read_agent(agent_id: int, current_user: User = Depends(get_current_active_user)):
        """Получить агента по ID"""
        if agent_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный ID агента"
            )
        
        agent = agent_service.get_agent(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Агент не найден"
            )
        return agent

    @app.put("/agents/{agent_id}", response_model=AgentPublic)
    def update_agent(
        agent_id: int,
        agent_update: AgentUpdate,
        current_user: User = Depends(get_current_active_user)
    ):
        """Обновить агента"""
        if agent_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный ID агента"
            )
        
        try:
            # Преобразуем AgentUpdate в словарь, исключая None значения
            update_dict = agent_update.model_dump(exclude_unset=True, exclude_none=True)
            
            if not update_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Нет полей для обновления"
                )
            
            result = agent_service.update_agent(agent_id, update_dict)
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Агент не найден"
                )
            
            logger.info(f"Agent updated: id={agent_id} by user {current_user.id}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating agent {agent_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить агента"
            )

    @app.delete("/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_agent(agent_id: int, current_user: User = Depends(get_current_active_user)):
        """Удалить агента"""
        if agent_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный ID агента"
            )
        
        try:
            success = agent_service.delete_agent(agent_id)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Агент не найден"
                )
            logger.info(f"Agent deleted: id={agent_id} by user {current_user.id}")
            return None
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting agent {agent_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить агента"
            )
