from typing import List, Optional
from fastapi import Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlmodel import Session
import logging
import os
import uuid
from pathlib import Path

from models.agent import AgentCreate, AgentPublic, AgentUpdate, UserAgentCreate
from models.user import User
from core.dependencies import get_current_active_user, get_session
from services.agent_service import AgentService
from services.user_agent_service import UserAgentService
from services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

# Директория для хранения аватаров пользовательских персонажей
USER_AGENTS_AVATARS_DIR = Path("static/user_agents")


def create_agent_endpoints(app, agent_service: AgentService, user_agent_service: UserAgentService = None):
    """Создать эндпоинты для агентов
    
    Args:
        app: FastAPI приложение
        agent_service: Сервис для работы с агентами
        user_agent_service: Сервис для работы с пользовательскими агентами (опционально)
    """
    
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
        """Получить список всех агентов (глобальных + пользовательских текущего пользователя)"""
        try:
            # Получаем глобальных агентов и персональных агентов текущего пользователя
            agents = agent_service.get_all_agents(category=category, user_id=current_user.id)
            
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

    # ==================== ПОЛЬЗОВАТЕЛЬСКИЕ ПЕРСОНАЖИ ====================
    # ВАЖНО: эти эндпоинты должны быть ДО /agents/{agent_id}, чтобы избежать конфликта маршрутов
    
    @app.get("/agents/user/my", response_model=List[AgentPublic])
    def get_my_agents(current_user: User = Depends(get_current_active_user)):
        """Получить список персонажей, созданных текущим пользователем"""
        try:
            # Используем UserAgentService, если он передан, иначе fallback на AgentService
            if user_agent_service:
                agents = user_agent_service.get_user_agents(current_user.id)
            else:
                agents = agent_service.get_user_agents(current_user.id)
            return agents
        except Exception as e:
            logger.error(f"Error getting user agents: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось получить список персонажей"
            )
    
    @app.post("/agents/user", response_model=AgentPublic, status_code=status.HTTP_201_CREATED)
    async def create_user_agent(
        name: str = Form(..., min_length=1, max_length=100, description="Имя персонажа"),
        instructions: str = Form(..., min_length=1, description="Промпт/инструкции для персонажа"),
        description: Optional[str] = Form(None, max_length=500, description="Описание персонажа"),
        avatar: Optional[UploadFile] = File(None, description="Аватар персонажа"),
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Создать нового пользовательского персонажа (только для Pro подписки)"""
        # Проверяем статус подписки
        subscription_status = SubscriptionService.check_subscription_status(current_user, db)
        
        # Проверяем, что подписка Pro и не истекла
        if subscription_status["subscription_tier"] != "pro" or subscription_status["is_expired"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Создание собственных персонажей доступно только для пользователей с подпиской Pro. Пожалуйста, обновите подписку."
            )
        
        try:
            avatar_url = None
            
            # Обрабатываем загрузку аватара
            if avatar and avatar.filename:
                # Создаем директорию, если не существует
                USER_AGENTS_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
                
                # Генерируем уникальное имя файла
                file_ext = os.path.splitext(avatar.filename)[1].lower()
                if file_ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Неподдерживаемый формат изображения. Используйте JPG, PNG, GIF или WebP"
                    )
                
                unique_filename = f"{current_user.id}_{uuid.uuid4().hex}{file_ext}"
                file_path = USER_AGENTS_AVATARS_DIR / unique_filename
                
                # Сохраняем файл
                content = await avatar.read()
                with open(file_path, "wb") as f:
                    f.write(content)
                
                avatar_url = f"/static/user_agents/{unique_filename}"
                logger.info(f"Avatar saved: {avatar_url}")
            
            # Создаем персонажа
            if user_agent_service:
                result = user_agent_service.create_user_agent(
                    user_id=current_user.id,
                    name=name,
                    description=description,
                    instructions=instructions,
                    avatar_url=avatar_url
                )
            else:
                result = agent_service.create_user_agent(
                    user_id=current_user.id,
                    name=name,
                    description=description,
                    instructions=instructions,
                    avatar_url=avatar_url
                )
            
            logger.info(f"User agent created: id={result.id}, name={result.name} by user {current_user.id}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating user agent: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Не удалось создать персонажа: {str(e)}"
            )
    
    @app.put("/agents/user/{agent_id}", response_model=AgentPublic)
    async def update_user_agent(
        agent_id: int,
        name: Optional[str] = Form(None, min_length=1, max_length=100),
        instructions: Optional[str] = Form(None, min_length=1),
        description: Optional[str] = Form(None, max_length=500),
        avatar: Optional[UploadFile] = File(None),
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_session)
    ):
        """Обновить пользовательского персонажа (только для Pro подписки)"""
        # Проверяем статус подписки
        subscription_status = SubscriptionService.check_subscription_status(current_user, db)
        
        # Проверяем, что подписка Pro и не истекла
        if subscription_status["subscription_tier"] != "pro" or subscription_status["is_expired"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Редактирование собственных персонажей доступно только для пользователей с подпиской Pro. Пожалуйста, обновите подписку."
            )
        
        if agent_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный ID агента"
            )
        
        try:
            avatar_url = None
            
            # Обрабатываем загрузку нового аватара
            if avatar and avatar.filename:
                USER_AGENTS_AVATARS_DIR.mkdir(parents=True, exist_ok=True)
                
                file_ext = os.path.splitext(avatar.filename)[1].lower()
                if file_ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Неподдерживаемый формат изображения"
                    )
                
                unique_filename = f"{current_user.id}_{uuid.uuid4().hex}{file_ext}"
                file_path = USER_AGENTS_AVATARS_DIR / unique_filename
                
                content = await avatar.read()
                with open(file_path, "wb") as f:
                    f.write(content)
                
                avatar_url = f"/static/user_agents/{unique_filename}"
            
            # Обновляем персонажа
            if user_agent_service:
                result = user_agent_service.update_user_agent(
                    agent_id=agent_id,
                    user_id=current_user.id,
                    name=name,
                    instructions=instructions,
                    description=description,
                    avatar_url=avatar_url
                )
                if not result:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Персонаж не найден или у вас нет прав для его редактирования"
                    )
            else:
                # Fallback на старый метод
                agent = agent_service.get_agent(agent_id)
                if not agent or agent.user_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Персонаж не найден"
                    )
                
                update_dict = {}
                if name is not None:
                    update_dict["name"] = name
                if instructions is not None:
                    update_dict["instructions"] = instructions
                if description is not None:
                    update_dict["description"] = description
                if avatar_url is not None:
                    update_dict["avatar_url"] = avatar_url
                
                if not update_dict:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Нет полей для обновления"
                    )
                
                result = agent_service.update_agent(agent_id, update_dict)
                if not result:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Персонаж не найден"
                    )
            
            logger.info(f"User agent updated: id={agent_id} by user {current_user.id}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating user agent {agent_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось обновить персонажа"
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
        """Удалить агента (только пользовательских персонажей)"""
        if agent_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный ID агента"
            )
        
        try:
            # Проверяем, является ли это пользовательским агентом
            agent = agent_service.get_agent(agent_id)
            if not agent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Агент не найден"
                )
            
            # Только владелец может удалить своего персонажа
            if agent.user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Нельзя удалить глобального агента"
                )
            
            # Используем UserAgentService для удаления, если он доступен
            if user_agent_service and agent.user_id == current_user.id:
                success = user_agent_service.delete_user_agent(agent_id, current_user.id)
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Агент не найден или у вас нет прав для его удаления"
                    )
            else:
                # Fallback на старый метод
                if agent.user_id != current_user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Нельзя удалить чужого персонажа"
                    )
                
                success = agent_service.delete_agent(agent_id)
                if not success:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Агент не найден"
                    )
            
            logger.info(f"User agent deleted: id={agent_id} by user {current_user.id}")
            return None
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting agent {agent_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось удалить агента"
            )

