from typing import Dict, Any, Optional, List, Union
from sqlmodel import Session, select, func
import logging
import re

from models.agent import Agent, AgentCreate, AgentPublic
from models.conversation import Conversation
from services.base_service import BaseService
from services.langchain_service import LangChainService
from services.image_generation_service import ImageGenerationService
from core.language_detector import LanguageDetector

logger = logging.getLogger(__name__)
# Явно выставляем уровень INFO, чтобы наши логи были видны вместе с uvicorn
logger.setLevel(logging.INFO)
logger.propagate = True


class AgentService(BaseService):
    """Сервис для работы с агентами"""
    
    def __init__(self):
        super().__init__()
        self.active_agents: Dict[int, Dict[str, Any]] = {}
        self.langchain_service = LangChainService()
        self.image_generation_service = ImageGenerationService()
    
    def initialize_agents(self) -> None:
        """Инициализация агентов из базы данных"""
        try:
            with self.get_session() as session:
                agents = session.exec(select(Agent)).all()
                logger.info(f"Найдено {len(agents)} агентов в базе данных")
                
                for agent in agents:
                    self.active_agents[agent.id] = {
                        "name": agent.name,
                        "instructions": agent.instructions,
                        "model": agent.model,
                        "category": agent.category or ""
                    }
                    logger.debug(f"Активирован агент: {agent.name} (ID: {agent.id}), категория: {agent.category}")
                
                logger.info(f"Всего активных агентов: {len(self.active_agents)}")
        except Exception as e:
            logger.error(f"Ошибка при инициализации агентов: {e}", exc_info=True)
            raise
    
    def create_agent(self, agent_data: AgentCreate) -> AgentPublic:
        """Создать нового агента
        
        Args:
            agent_data: Данные для создания агента
            
        Returns:
            Созданный агент
            
        Raises:
            Exception: При ошибке создания агента в БД
        """
        try:
            with self.get_session() as session:
                db_agent = Agent.model_validate(agent_data)
                session.add(db_agent)
                session.commit()
                session.refresh(db_agent)
                
                # Добавляем в активные агенты
                self.active_agents[db_agent.id] = {
                    "name": db_agent.name,
                    "instructions": db_agent.instructions,
                    "model": db_agent.model,
                    "category": db_agent.category or ""
                }
                
                logger.info(f"Создан новый агент: {db_agent.name} (ID: {db_agent.id})")
                return AgentPublic.model_validate(db_agent)
        except Exception as e:
            logger.error(f"Ошибка при создании агента: {e}", exc_info=True)
            raise
    
    def get_agent(self, agent_id: int) -> Optional[AgentPublic]:
        """Получить агента по ID
        
        Args:
            agent_id: ID агента
            
        Returns:
            Агент или None, если не найден
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                if agent:
                    return AgentPublic.model_validate(agent)
                return None
        except Exception as e:
            logger.error(f"Ошибка при получении агента {agent_id}: {e}", exc_info=True)
            return None
    
    def get_all_agents(self, category: Optional[str] = None) -> List[AgentPublic]:
        """Получить всех агентов, опционально отфильтрованных по категории
        
        Args:
            category: Категория для фильтрации (опционально). 
                     Поддерживает фильтрацию по категориям, разделенным запятыми.
                     Например, если категория агента "персонаж, политик", 
                     то фильтрация по "персонаж" или "политик" найдет этого агента.
            
        Returns:
            Список активных агентов (is_active=True или NULL)
        """
        try:
            with self.get_session() as session:
                # КРИТИЧНО: Фильтруем только активных агентов
                # Агенты каналов имеют is_active=False и не должны показываться в библиотеке
                query = select(Agent).where(
                    (Agent.is_active == True) | (Agent.is_active.is_(None))  # noqa: E712
                )
                
                if category:
                    # Поддерживаем фильтрацию по категориям, разделенным запятыми
                    # Ищем агентов, у которых категория содержит указанную категорию
                    # Используем LIKE для поиска подстроки в категории
                    category_lower = category.lower().strip()
                    # Используем LIKE с % для поиска подстроки
                    query = query.where(
                        func.lower(Agent.category).like(f"%{category_lower}%")
                    )
                agents = session.exec(query).all()
                
                # Дополнительная дедупликация по названию (на случай если есть дубликаты в БД)
                unique_agents_map = {}
                for agent in agents:
                    agent_name_lower = agent.name.lower().strip()
                    if agent_name_lower not in unique_agents_map:
                        unique_agents_map[agent_name_lower] = agent
                    else:
                        # Если есть дубликат, оставляем агента с меньшим ID (старше)
                        existing = unique_agents_map[agent_name_lower]
                        if agent.id < existing.id:
                            unique_agents_map[agent_name_lower] = agent
                            logger.warning(
                                f"Дубликат агента по названию '{agent.name}': оставляем ID={agent.id}, удаляем ID={existing.id}"
                            )
                
                return [AgentPublic.model_validate(agent) for agent in unique_agents_map.values()]
        except Exception as e:
            logger.error(f"Ошибка при получении агентов: {e}", exc_info=True)
            return []
    
    def get_all_categories(self) -> List[str]:
        """Получить список всех уникальных категорий агентов
        
        Returns:
            Отсортированный список категорий (включая категории, разделенные запятыми)
        """
        try:
            with self.get_session() as session:
                # Получаем все категории агентов
                agents = session.exec(
                    select(Agent.category)
                    .where(Agent.category.isnot(None))
                ).all()
                
                # Разбиваем категории по запятым и собираем уникальные
                unique_categories = set()
                for category_str in agents:
                    if category_str:
                        # Разбиваем по запятым и очищаем от пробелов
                        categories = [cat.strip() for cat in category_str.split(",")]
                        unique_categories.update(categories)
                
                return sorted([cat for cat in unique_categories if cat])
        except Exception as e:
            logger.error(f"Ошибка при получении категорий: {e}", exc_info=True)
            return []
    
    def update_agent(self, agent_id: int, agent_update: dict) -> Optional[AgentPublic]:
        """Обновить агента
        
        Args:
            agent_id: ID агента для обновления
            agent_update: Словарь с полями для обновления
            
        Returns:
            Обновленный агент или None, если не найден
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                if not agent:
                    logger.warning(f"Попытка обновить несуществующего агента: {agent_id}")
                    return None
                
                # Обновляем только переданные поля
                for key, value in agent_update.items():
                    if value is not None and hasattr(agent, key):
                        setattr(agent, key, value)
                
                # Обновляем кэш активных агентов
                if agent_id in self.active_agents:
                    self.active_agents[agent_id] = {
                        "name": agent.name,
                        "instructions": agent.instructions,
                        "model": agent.model,
                        "category": agent.category or ""
                    }
                
                session.add(agent)
                session.commit()
                session.refresh(agent)
                
                logger.info(f"Агент {agent_id} успешно обновлен")
                return AgentPublic.model_validate(agent)
        except Exception as e:
            logger.error(f"Ошибка при обновлении агента {agent_id}: {e}", exc_info=True)
            raise
    
    def delete_agent(self, agent_id: int) -> bool:
        """Удалить агента
        
        Args:
            agent_id: ID агента для удаления
            
        Returns:
            True, если агент успешно удален, False если не найден
        """
        try:
            with self.get_session() as session:
                agent = session.get(Agent, agent_id)
                if not agent:
                    logger.warning(f"Попытка удалить несуществующего агента: {agent_id}")
                    return False
                
                # Удаляем из активных агентов
                if agent_id in self.active_agents:
                    del self.active_agents[agent_id]
                
                session.delete(agent)
                session.commit()
                logger.info(f"Агент {agent_id} успешно удален")
                return True
        except Exception as e:
            logger.error(f"Ошибка при удалении агента {agent_id}: {e}", exc_info=True)
            return False
    
    def is_agent_active(self, agent_id: int) -> bool:
        """Проверить, активен ли агент
        
        Args:
            agent_id: ID агента
            
        Returns:
            True, если агент активен
        """
        return agent_id in self.active_agents
    
    def get_active_agent(self, agent_id: int) -> Optional[Dict[str, Any]]:
        """Получить активного агента
        
        Args:
            agent_id: ID агента
            
        Returns:
            Словарь с данными агента или None, если агент не активен
        """
        return self.active_agents.get(agent_id)
    
    def _is_image_generation_request(self, message: str) -> bool:
        """Проверяет, является ли запрос запросом на генерацию изображения"""
        if not message:
            return False
        
        message_lower = message.lower().strip()
        
        # Список ключевых слов для действий
        action_keywords = ["сгенерируй", "создай", "нарисуй", "покажи", "сделай", "generate", "create", "draw", "show", "make"]
        # Список ключевых слов для изображений
        image_keywords = ["картинку", "картинка", "изображение", "рисунок", "рисунка", "фото", "picture", "image", "images"]
        
        # Проверяем наличие ключевых слов
        has_action = any(keyword in message_lower for keyword in action_keywords)
        has_image = any(keyword in message_lower for keyword in image_keywords)
        
        result = has_action and has_image
        if result:
            logger.debug(f"🔍 [IMAGE DETECTION] Запрос определен как запрос на генерацию изображения: '{message_lower[:50]}...'")
        
        return result
    
    async def generate_response(
        self, 
        agent_id: int, 
        message: str, 
        conversation_id: Optional[str] = None,
        is_multi_agent: bool = False,
        image_attachments: Optional[List[Dict]] = None,
        language: Optional[str] = None
    ) -> Union[str, Dict[str, Any]]:
        """Генерировать ответ агента через LangChain
        
        Args:
            agent_id: ID агента
            message: Сообщение пользователя
            conversation_id: ID беседы (опционально)
            is_multi_agent: Флаг, указывающий что это групповой чат (используется для уникального conversation_id)
            
        Returns:
            Ответ агента
            
        Raises:
            ValueError: Если агент не найден или не активен
        """
        logger.info(f"🚀 [GENERATE RESPONSE] Начало генерации ответа: agent_id={agent_id}, conversation_id={conversation_id}, message_length={len(message) if message else 0}")
        
        agent = self.get_active_agent(agent_id)
        if not agent:
            error_msg = f"Агент {agent_id} не найден или не активен"
            logger.warning(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Инициализируем переменные для RAG контекста
            notes_history_context = None
            purchase_history_context = None
            todo_context = None
            progress_context = None
            travel_context = None
            
            # Определяем язык из сообщения пользователя
            # Если язык не передан явно, определяем его автоматически из сообщения
            detected_language = language
            if detected_language is None:
                try:
                    if isinstance(message, str):
                        detected_language = LanguageDetector.detect(message)
                    elif isinstance(message, list):
                        # Сообщение может содержать изображения; извлекаем текстовые части
                        text_parts = [
                            item.get("text", "")
                            for item in message
                            if isinstance(item, dict) and item.get("type") == "text"
                        ]
                        detected_language = LanguageDetector.detect(" ".join(text_parts))
                    
                    if detected_language:
                        language_name = LanguageDetector.get_language_name(detected_language)
                        logger.info(
                            "🈯 Автоматически определён язык сообщения для агента %s: %s (%s)",
                            agent_id,
                            detected_language,
                            language_name,
                        )
                    else:
                        logger.debug(
                            "⚠️ Не удалось определить язык сообщения для агента %s, будет использована общая инструкция",
                            agent_id,
                        )
                except Exception as e:
                    logger.warning(
                        f"Ошибка при определении языка сообщения для агента {agent_id}: {e}",
                        exc_info=True
                    )
                    detected_language = None

            # Получаем правила пользователя и модель из беседы ДО изменения conversation_id для мульти-агентных чатов
            # Важно: правила и модель связаны с оригинальной беседой, а не с уникальным conversation_id для агента
            # ВАЖНО: всегда загружаем правила и модель заново из БД при каждом запросе, чтобы гарантировать актуальность
            user_rules: Optional[List[str]] = None
            conversation_model: Optional[str] = None  # Модель из чата
            original_conv_id = None
            if conversation_id:
                try:
                    # Пытаемся извлечь оригинальный conversation_id из строки вида "74_agent_5"
                    if "_agent_" in str(conversation_id):
                        original_conv_id = int(str(conversation_id).split("_agent_")[0])
                    else:
                        original_conv_id = int(conversation_id)
                    
                    # Всегда загружаем правила и модель из БД при каждом запросе
                    with self.get_session() as session:
                        conversation = session.get(Conversation, original_conv_id)
                        if conversation:
                            rules = conversation.get_user_rules()
                            user_rules = rules if rules else []  # Всегда передаем список, даже пустой
                            if user_rules:
                                logger.debug(f"✅ Загружено {len(user_rules)} правил пользователя для беседы {original_conv_id}: {user_rules}")
                            else:
                                logger.debug(f"📋 Правил пользователя нет для беседы {original_conv_id} (пустой список)")
                            
                            # Получаем модель из чата (если установлена)
                            conversation_model = conversation.selected_model
                            if conversation_model:
                                logger.debug(f"🎯 Используется модель из чата для беседы {original_conv_id}: {conversation_model}")
                            else:
                                logger.debug(f"📋 Модель из чата не установлена для беседы {original_conv_id}, будет использована модель агента")
                        else:
                            logger.debug(f"⚠️ Беседа {original_conv_id} не найдена в БД")
                            user_rules = []  # Передаем пустой список, чтобы обновить системное сообщение
                except (ValueError, TypeError) as e:
                    # conversation_id не число или ошибка парсинга - пропускаем правила
                    logger.debug(f"⚠️ conversation_id '{conversation_id}' не является числом: {e}")
                    user_rules = None  # Не передаем правила
                except Exception as e:
                    logger.warning(f"❌ Ошибка при получении правил пользователя для беседы {conversation_id}: {e}", exc_info=True)
                    user_rules = None  # Не передаем правила в случае ошибки
            
            # Для групповых чатов используем уникальный conversation_id для каждого агента
            # чтобы избежать смешивания истории разных агентов
            unique_conversation_id = conversation_id
            if is_multi_agent and conversation_id:
                unique_conversation_id = f"{conversation_id}_agent_{agent_id}"
                logger.debug(f"Используется уникальный conversation_id для агента {agent_id} в групповом чате: {unique_conversation_id}")
            
            # Инструменты для агентов
            agent_category = agent.get("category", "").lower()
            agent_name = agent.get("name", "").lower().strip()
            
            logger.info(f"[AGENT DEBUG] Обработка агента: name='{agent.get('name')}', id={agent_id}, category='{agent_category}'")
            
            # Если категория пустая, пытаемся загрузить из БД
            if not agent_category:
                try:
                    with self.get_session() as session:
                        db_agent = session.get(Agent, agent_id)
                        if db_agent and db_agent.category:
                            agent_category = db_agent.category.lower()
                            # Обновляем в active_agents для будущих запросов
                            agent["category"] = db_agent.category
                            logger.info(f"✅ [TOOLS DEBUG] Загружена категория из БД для агента {agent_id}: {agent_category}")
                except Exception as e:
                    logger.warning(f"⚠️ [TOOLS DEBUG] Ошибка при загрузке категории из БД для агента {agent_id}: {e}")
            
            # Fallback: если категория не заполнена в БД, но это агент "Таймер и напоминания"
            if (not agent_category or ("timer" not in agent_category or "reminder" not in agent_category)) and agent.get("name", "").lower().strip() == "таймер и напоминания":
                agent_category = "tools, timer, reminder"
                logger.warning(f"[TOOLS DEBUG] Категория агента '{agent.get('name')}' была пустой, установлена fallback: {agent_category}")
            
            # Fallback: если категория не заполнена в БД, но это агент "Конвертер валют"
            if (not agent_category or ("currency" not in agent_category and "converter" not in agent_category)) and agent.get("name", "").lower().strip() == "конвертер валют":
                agent_category = "tools, currency, converter"
                logger.warning(f"[TOOLS DEBUG] Категория агента '{agent.get('name')}' была пустой, установлена fallback: {agent_category}")
            
            # Fallback: если категория не заполнена в БД, но это агент "Поиск в интернете"
            if (not agent_category or ("web_search" not in agent_category and "search" not in agent_category)) and agent.get("name", "").lower().strip() == "поиск в интернете":
                agent_category = "tools, web_search, search"
                logger.warning(f"[TOOLS DEBUG] Категория агента '{agent.get('name')}' была пустой, установлена fallback: {agent_category}")
            
            
            # Fallback: если категория не заполнена в БД, но это агент "Кулинарный советник"
            if (not agent_category or ("cooking" not in agent_category and "recipes" not in agent_category and "food" not in agent_category)) and agent.get("name", "").lower().strip() == "кулинарный советник":
                agent_category = "tools, cooking, recipes, food"
                logger.warning(f"[TOOLS DEBUG] Категория агента '{agent.get('name')}' была пустой, установлена fallback: {agent_category}")
            
            # Fallback: если категория не заполнена в БД, но это агент "Заметки"
            if (not agent_category or ("notes" not in agent_category and "journal" not in agent_category and "ideas" not in agent_category)) and agent.get("name", "").lower().strip() == "заметки":
                agent_category = "tools, notes, journal, ideas"
                logger.warning(f"[TOOLS DEBUG] Категория агента '{agent.get('name')}' была пустой, установлена fallback: {agent_category}")
            
            tools = None
            
            # Для агента "Таймер и напоминания" предоставляем инструменты timer и reminder
            if "timer" in agent_category and "reminder" in agent_category:
                logger.warning(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → подключаем timer/reminder")
                from tools.timer_tool import create_timer_tool, create_reminder_tool, _context_storage
                
                # Устанавливаем контекст разговора для инструментов
                # Извлекаем оригинальный conversation_id (для групповых чатов может быть формат "id_agent_X")
                original_conv_id = conversation_id
                if conversation_id and isinstance(conversation_id, str) and "_agent_" in conversation_id:
                    try:
                        original_conv_id = int(conversation_id.split("_agent_")[0])
                    except (ValueError, AttributeError):
                        logger.warning(f"Не удалось извлечь conversation_id из {conversation_id}")
                elif conversation_id and isinstance(conversation_id, str) and conversation_id.isdigit():
                    original_conv_id = int(conversation_id)
                
                if original_conv_id:
                    try:
                        _context_storage.conversation_id = original_conv_id
                        logger.info(f"✅ [TIMER TOOL] Установлен conversation_id={original_conv_id} в контекст для инструментов таймера")
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"⚠️ [TIMER TOOL] Не удалось установить conversation_id для инструментов: {original_conv_id}, ошибка: {e}")
                else:
                    logger.warning(f"⚠️ [TIMER TOOL] original_conv_id не установлен! conversation_id={conversation_id}")
                
                try:
                    _context_storage.agent_id = agent_id
                    logger.info(f"✅ [TIMER TOOL] Установлен agent_id={agent_id} в контекст для инструментов таймера")
                except Exception as e:
                    logger.warning(f"⚠️ [TIMER TOOL] Не удалось установить agent_id: {e}")
                
                timer_tool = create_timer_tool(conversation_id=original_conv_id, agent_id=agent_id)
                reminder_tool = create_reminder_tool(conversation_id=original_conv_id, agent_id=agent_id)
                tools = [timer_tool, reminder_tool]
                logger.info(f"✅ [TIMER TOOL] Агент {agent['name']} будет использовать инструменты timer и reminder (conversation_id={original_conv_id}, agent_id={agent_id}, original={conversation_id})")
            
            # Для агента "Конвертер валют" предоставляем инструмент currency_converter
            elif "currency" in agent_category or "converter" in agent_category:
                logger.info(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → подключаем currency_converter")
                from tools.currency_converter_tool import create_currency_converter_tool
                
                currency_tool = create_currency_converter_tool()
                tools = [currency_tool]
                logger.info(f"✅ [CURRENCY TOOL] Агент {agent['name']} будет использовать инструмент currency_converter")
            
            # Для агента "Поиск в интернете" или AI новостей предоставляем инструмент web_search
            elif "web_search" in agent_category or "search" in agent_category or "ai-news" in agent_category or "ai" in agent_category:
                logger.info(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → подключаем web_search")
                from tools.web_search_tool import create_web_search_tool
                
                web_search_tool = create_web_search_tool()
                tools = [web_search_tool]
                logger.info(f"✅ [WEB SEARCH TOOL] Агент {agent['name']} будет использовать инструмент web_search")
            
            # Для агента "Создатель тестов" предоставляем инструмент exam_preparation
            elif "exam" in agent_category or "test" in agent_category or "quiz" in agent_category:
                logger.info(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → подключаем exam_preparation")
                from tools.exam_preparation_tool import create_exam_preparation_tool
                
                exam_preparation_tool = create_exam_preparation_tool()
                tools = [exam_preparation_tool]
                logger.info(f"✅ [EXAM PREPARATION TOOL] Агент {agent['name']} будет использовать инструмент exam_preparation")
            
            # Для агента "Кулинарный советник" предоставляем инструмент cooking_advisor
            elif "cooking" in agent_category or "recipes" in agent_category or "food" in agent_category:
                logger.info(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → подключаем cooking_advisor")
                from tools.cooking_advisor_tool import create_cooking_advisor_tool
                
                cooking_advisor_tool = create_cooking_advisor_tool()
                tools = [cooking_advisor_tool]
                logger.info(f"✅ [COOKING ADVISOR TOOL] Агент {agent['name']} будет использовать инструмент cooking_advisor")
            
            # УДАЛЕНО - инструменты для удаленных моделей:
            # - dietitian_tool
            # - purchase_tracker_tool
            # - notes_tool
            # - todo_service (RAG)
            # - progress_service (RAG)
            # - travel_service (RAG)

            else:
                logger.warning(f"[TOOLS DEBUG] Агент '{agent.get('name')}' (id={agent_id}) категория={agent_category} → инструменты НЕ подключены")
            
            # Инициализируем enhanced_message с исходным сообщением
            enhanced_message = message
            
            # УДАЛЕНО - RAG контексты для удаленных инструментов:
            # - purchase_history_context
            # - notes_history_context
            # - todo_context
            # - progress_context
            # - travel_context

            # Для таймера/напоминаний усиливаем инструкцию, чтобы LLM обязательно вызывал инструменты
            if tools and "timer" in agent_category and "reminder" in agent_category:
                enhanced_message = (
                    f"{message}\n\n"
                    "[ИНСТРУКЦИЯ АГЕНТУ]\n"
                    "Всегда вызывай инструменты timer или reminder. Не отвечай без вызова инструмента.\n"
                    "Если нужно установить таймер, вызови timer с duration (строка) и message (опционально).\n"
                    "Если нужно создать напоминание, вызови reminder с time (строка) и message (текст напоминания).\n"
                    "Примеры:\n"
                    "- timer: duration='30 секунд', message='о походе в спортзал'\n"
                    "- reminder: time='через 30 секунд', message='о походе в спортзал'\n"
                )
                
            # Если есть инструменты, используем generate_response_with_tools
            if tools:
                return await self.langchain_service.generate_response_with_tools(
                    agent_name=agent["name"],
                    instructions=agent["instructions"],
                    user_message=enhanced_message,
                    tools=tools,
                    conversation_id=unique_conversation_id,
                    model=agent.get("model"),  # Передаем модель агента
                    user_rules=user_rules,  # Передаем правила пользователя (None или список)
                    language=detected_language,  # Передаем язык для ответа
                )
            else:
                # Проверяем, является ли запрос запросом на генерацию изображения
                message_text = enhanced_message
                if isinstance(enhanced_message, list):
                    # Извлекаем текстовую часть из сообщения
                    text_parts = [
                        item.get("text", "")
                        for item in enhanced_message
                        if isinstance(item, dict) and item.get("type") == "text"
                    ]
                    message_text = " ".join(text_parts) if text_parts else str(enhanced_message)
                
                if self._is_image_generation_request(message_text):
                    logger.info(f"🎨 [IMAGE GENERATION] Обнаружен запрос на генерацию изображения: {message_text[:100]}")
                    try:
                        # Генерируем изображение
                        image_result = await self.image_generation_service.generate_image(
                            prompt=message_text,
                            size="1024x1024",
                            quality="standard"
                        )
                        
                        if image_result and image_result.get("url"):
                            # Скачиваем изображение и преобразуем в base64
                            image_base64 = await self.image_generation_service.download_image_as_base64(
                                image_result["url"]
                            )
                            
                            if image_base64:
                                # Возвращаем структуру с текстом и изображением
                                response_text = "Вот сгенерированное изображение по вашему запросу."
                                if image_result.get("revised_prompt"):
                                    response_text += f"\n\nУлучшенный промпт: {image_result['revised_prompt']}"
                                
                                logger.info(f"✅ [IMAGE GENERATION] Изображение успешно сгенерировано и скачано, текст ответа: '{response_text[:50]}...'")
                                
                                result = {
                                    "text": response_text,
                                    "image": {
                                        "base64": image_base64,
                                        "url": image_result["url"],
                                        "revised_prompt": image_result.get("revised_prompt")
                                    }
                                }
                                logger.debug(f"📤 [IMAGE GENERATION] Возвращаем результат: text={len(response_text)} символов, image={'есть' if result.get('image') else 'нет'}")
                                return result
                            else:
                                # Если не удалось скачать, возвращаем URL
                                logger.warning(f"⚠️ [IMAGE GENERATION] Не удалось скачать изображение, возвращаем URL")
                                response_text = f"Изображение сгенерировано! URL: {image_result['url']}"
                                return {
                                    "text": response_text,
                                    "image": {
                                        "url": image_result["url"],
                                        "revised_prompt": image_result.get("revised_prompt")
                                    }
                                }
                        else:
                            # Если генерация не удалась, возвращаем понятное сообщение
                            logger.warning("⚠️ [IMAGE GENERATION] Не удалось сгенерировать изображение")
                            # Возвращаем сообщение пользователю о том, что генерация недоступна
                            return "Извините, генерация изображений временно недоступна. Пожалуйста, убедитесь, что установлен OPENAI_API_KEY в настройках сервера."
                    except Exception as e:
                        logger.error(f"❌ [IMAGE GENERATION] Ошибка при генерации изображения: {e}", exc_info=True)
                        # Возвращаем понятное сообщение об ошибке
                        error_message = str(e)
                        if "OPENAI_API_KEY" in error_message or "api key" in error_message.lower():
                            return "Извините, генерация изображений недоступна. Необходимо настроить OPENAI_API_KEY в настройках сервера."
                        else:
                            return f"Извините, произошла ошибка при генерации изображения: {error_message}. Пожалуйста, попробуйте позже."
                
                # Используем LangChain сервис для генерации ответа
                # ВАЖНО: передаём enhanced_message, чтобы RAG-контекст (журнал задач, покупки и т.п.)
                # действительно участвовал в генерации ответа даже без инструментов
                # Всегда передаем user_rules (может быть пустым списком), чтобы принудительно обновить системное сообщение
                logger.debug(f"📝 [GENERATE RESPONSE] Вызываем LangChain для генерации обычного ответа")
                # Используем модель из чата, если она установлена, иначе модель агента
                model_to_use = conversation_model if conversation_model else agent.get("model")
                logger.debug(f"🤖 [GENERATE RESPONSE] Используемая модель: {model_to_use} (из чата: {conversation_model is not None}, из агента: {conversation_model is None})")
                
                llm_response = await self.langchain_service.generate_response(
                    agent_name=agent["name"],
                    instructions=agent["instructions"],
                    user_message=enhanced_message,
                    conversation_id=unique_conversation_id,
                    model=model_to_use,  # Используем модель из чата или модель агента
                    user_rules=user_rules,  # Передаем правила пользователя (None или список)
                    image_attachments=image_attachments,  # Передаем изображения для моделей с vision
                    language=detected_language,  # Передаем язык для ответа
                )
                
                # Проверяем, что ответ не пустой
                if not llm_response or (isinstance(llm_response, str) and len(llm_response.strip()) == 0):
                    logger.warning(f"⚠️ [GENERATE RESPONSE] LangChain вернул пустой ответ, используем fallback")
                    llm_response = "Извините, не удалось сгенерировать ответ. Пожалуйста, попробуйте еще раз."
                
                logger.debug(f"✅ [GENERATE RESPONSE] LangChain вернул ответ длиной {len(str(llm_response))} символов")
                return llm_response
        except Exception as e:
            logger.error(f"Ошибка при генерации ответа агента {agent_id}: {e}", exc_info=True)
            raise ValueError(f"Не удалось сгенерировать ответ для агента {agent_id}: {e}") from e
    
    def clear_conversation_history(self, conversation_id: str) -> None:
        """Очистить историю сообщений для конкретной беседы
        
        Args:
            conversation_id: ID беседы
        """
        try:
            self.langchain_service.clear_conversation_history(conversation_id)
            logger.info(f"История беседы {conversation_id} очищена")
        except Exception as e:
            logger.error(f"Ошибка при очистке истории беседы {conversation_id}: {e}", exc_info=True)
            raise
    
    def clear_conversation_system_message(self, conversation_id: str) -> None:
        """Очистить системное сообщение для конкретной беседы
        
        Это позволяет обновить системное сообщение с новыми правилами пользователя.
        
        Args:
            conversation_id: ID беседы
        """
        try:
            self.langchain_service.clear_conversation_system_message(conversation_id)
            logger.debug(f"Системное сообщение беседы {conversation_id} очищено")
        except Exception as e:
            logger.warning(f"Ошибка при очистке системного сообщения беседы {conversation_id}: {e}")
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, str]]:
        """Получить историю сообщений для беседы
        
        Args:
            conversation_id: ID беседы
            
        Returns:
            Список сообщений из истории
        """
        try:
            return self.langchain_service.get_message_history(conversation_id)
        except Exception as e:
            logger.error(f"Ошибка при получении истории беседы {conversation_id}: {e}", exc_info=True)
            return []
    
    async def test_connection(self) -> bool:
        """Тестировать подключение к LLM через LangChain
        
        Returns:
            True, если подключение успешно, False в противном случае
        """
        try:
            return await self.langchain_service.test_connection()
        except Exception as e:
            logger.error(f"Ошибка при тестировании подключения: {e}", exc_info=True)
            return False
    
    async def generate_response_with_tools(
        self, 
        agent_id: int, 
        message: str, 
        tools: Optional[List[Any]] = None,
        conversation_id: Optional[str] = None,
        is_multi_agent: bool = False
    ) -> str:
        """Генерировать ответ агента с использованием инструментов
        
        Args:
            agent_id: ID агента
            message: Сообщение пользователя
            tools: Список инструментов (опционально)
            conversation_id: ID беседы (опционально)
            is_multi_agent: Флаг, указывающий что это групповой чат (используется для уникального conversation_id)
            
        Returns:
            Ответ агента с использованием инструментов
            
        Raises:
            ValueError: Если агент не найден или не активен
        """
        agent = self.get_active_agent(agent_id)
        if not agent:
            error_msg = f"Агент {agent_id} не найден или не активен"
            logger.warning(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Для групповых чатов используем уникальный conversation_id для каждого агента
            unique_conversation_id = conversation_id
            if is_multi_agent and conversation_id:
                unique_conversation_id = f"{conversation_id}_agent_{agent_id}"
                logger.debug(f"Используется уникальный conversation_id для агента {agent_id} в групповом чате: {unique_conversation_id}")
            
            # Получаем правила пользователя из беседы, если conversation_id указан
            user_rules: List[str] = []
            if conversation_id:
                try:
                    conv_id = int(conversation_id)
                    with self.get_session() as session:
                        conversation = session.get(Conversation, conv_id)
                        if conversation:
                            user_rules = conversation.get_user_rules()
                            if user_rules:
                                logger.debug(f"Загружено {len(user_rules)} правил пользователя для беседы {conv_id}")
                except (ValueError, TypeError):
                    # conversation_id не число или ошибка парсинга - пропускаем правила
                    pass
                except Exception as e:
                    logger.warning(f"Ошибка при получении правил пользователя для беседы {conversation_id}: {e}")
            
            return await self.langchain_service.generate_response_with_tools(
                agent_name=agent["name"],
                instructions=agent["instructions"],
                user_message=message,
                tools=tools,
                conversation_id=unique_conversation_id,
                model=agent.get("model"),  # Передаем модель агента
                user_rules=user_rules  # Передаем правила пользователя
            )
        except Exception as e:
            logger.error(f"Ошибка при генерации ответа с инструментами для агента {agent_id}: {e}", exc_info=True)
            raise ValueError(f"Не удалось сгенерировать ответ с инструментами для агента {agent_id}: {e}") from e
