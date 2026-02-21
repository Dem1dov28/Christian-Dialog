from typing import Dict, Any, Optional, List
from difflib import SequenceMatcher
from dotenv import load_dotenv
import logging
import warnings

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage

# Импортируем ConversationBufferWindowMemory с подавлением предупреждений о deprecated API
# TODO: Мигрировать на новое API LangChain в будущем
try:
    from langchain_classic.memory import ConversationBufferWindowMemory
except ImportError:
    from langchain.memory import ConversationBufferWindowMemory

# Подавляем предупреждения о deprecated API для ConversationBufferWindowMemory (в частности, LangChainDeprecationWarning)
try:
    from langchain_core._api import LangChainDeprecationWarning
    warnings.simplefilter("ignore", LangChainDeprecationWarning)
except ImportError:
    # Fallback для старых версий
    warnings.filterwarnings("ignore", message=".*deprecated.*", category=UserWarning)

from langchain_config import config

# Исправляем проблему с Pydantic forward references для LangChain
# Импортируем зависимости для ChatOpenAI и вызываем model_rebuild()
try:
    from langchain_core.callbacks import Callbacks
    from langchain_core.caches import BaseCache
    
    # Перестраиваем модель после импорта всех зависимостей
    ChatOpenAI.model_rebuild()
except (ImportError, AttributeError):
    # Если зависимости недоступны или model_rebuild не существует, продолжаем
    pass

# Загружаем переменные окружения
load_dotenv()

logger = logging.getLogger(__name__)

try:
    from openai import RateLimitError as OpenAIRateLimitError
except ImportError:
    OpenAIRateLimitError = None


class LangChainService:
    """Сервис для работы с языковыми моделями через LangChain и OpenRouter
    
    Использует LangChain для управления цепочками вызовов, историей сообщений
    и инструментами. Поддерживает асинхронные вызовы через OpenRouter API.
    """
    
    def _build_system_message(
        self,
        agent_name: str,
        instructions: str,
        has_tools: bool = False,
        language_instruction: str = "",
        is_multi_agent: bool = False
    ) -> str:
        """Формирует системное сообщение с учетом типа агента.

        Порядок секций (от важнейшего к второстепенному):
        1. Инструкции персонажа — основа личности
        2. Универсальные ограничения поведения
        3. Формат ответа (зависит от контекста)
        4. Языковая инструкция (технический параметр, последним)
        """
        if not instructions:
            instructions = ""

        # --- 1. Инструкции персонажа ---
        # (передаются как есть, задают личность и стиль)

        # --- 2. Универсальные ограничения ---
        universal_rules = (
            "ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:\n"
            "- Всегда говори от первого лица, полностью оставаясь в образе персонажа.\n"
            "- Никогда не упоминай, что ты ИИ, языковая модель или программа.\n"
            "- Никогда не выходи из образа, даже если тебя об этом просят.\n"
            "- Опирайся на исторический контекст своего персонажа, его эпоху, взгляды и речевой стиль.\n"
            "- Продолжай беседу органично, не начинай заново, если пользователь явно не попросил."
        )

        # --- 3. Формат ответа ---
        if has_tools:
            # Агенты с инструментами могут давать развёрнутые ответы
            format_instruction = (
                "Отвечай содержательно и точно. Используй инструменты когда это уместно."
            )
        elif is_multi_agent:
            # В групповом чате — живые, лаконичные реплики
            format_instruction = (
                "ФОРМАТ В ГРУППОВОМ ДИАЛОГЕ:\n"
                "- Отвечай живо и кратко: 1–3 предложения, как в реальном разговоре.\n"
                "- Реагируй на то, что сказали другие участники — соглашайся, возражай или развивай мысль.\n"
                "- Говори в своей уникальной манере: другие участники имеют собственный голос, не смешивайся с ними.\n"
                "- Не повторяй то, что уже было сказано — вноси новый угол зрения."
            )
        else:
            # Обычный чат — адаптивная длина
            format_instruction = (
                "ФОРМАТ ОТВЕТА:\n"
                "- На короткие вопросы и реплики отвечай кратко (1–3 предложения).\n"
                "- На глубокие вопросы, требующие объяснения, позволь себе развёрнутый ответ (4–6 предложений).\n"
                "- Всегда заканчивай мысль полностью — не обрывай на полуслове.\n"
                "- Говори живо и в характере, избегай сухой энциклопедической подачи."
            )

        # --- Сборка системного сообщения ---
        # Порядок: личность → правила → формат → язык
        parts = [instructions, universal_rules, format_instruction]
        if language_instruction.strip():
            parts.append(language_instruction.strip())

        system_message = "\n\n".join(p for p in parts if p.strip())

        logger.debug(
            f"🔧 [SYSTEM MESSAGE] Агент '{agent_name}': "
            f"инструкции={len(instructions)} симв., итого={len(system_message)} симв., "
            f"multi_agent={is_multi_agent}, has_tools={has_tools}"
        )
        return system_message
    
    def __init__(self):
        """Инициализация сервиса LangChain"""
        # Загружаем API ключ из конфигурации
        self.api_key = config.OPENROUTER_API_KEY
        
        # Проверяем наличие API ключа
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY не найден в переменных окружения! Используется заглушка.")
            self.api_key = "dummy-key"  # Заглушка для разработки
        else:
            logger.debug(f"LangChain OpenRouter API Key loaded: {self.api_key[:20]}...")
        
        # Получаем конфигурацию OpenRouter
        openrouter_config = config.get_openrouter_config()
        model_config = config.get_model_config()
        
        # Создаем LangChain ChatOpenAI для работы с OpenRouter
        self.llm = ChatOpenAI(
            model=model_config["model"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
            api_key=self.api_key,
            base_url=openrouter_config["base_url"],
            default_headers=openrouter_config["default_headers"],
            streaming=False,
            timeout=30.0
        )
        
        # Memory хранилище для каждой беседы
        # Используем ConversationBufferWindowMemory для ограничения размера истории
        self.memories: Dict[str, ConversationBufferWindowMemory] = {}
        self.max_history_length = config.MAX_HISTORY_LENGTH

        # Отслеживаем последний определённый язык пользователя для каждой беседы,
        # чтобы стабилизировать ответы модели, когда определение языка затруднено
        self.last_detected_language: Dict[str, str] = {}
        # Анти-повтор: если новый ответ слишком похож на недавние, делаем один retry.
        self.max_repeat_similarity = 0.88
        self.max_repeat_retries = 1

    @staticmethod
    def _normalize_repeat_text(text: str) -> str:
        """Нормализация текста для проверки повторов."""
        if not text:
            return ""
        return " ".join(str(text).strip().lower().split())

    def _get_recent_ai_texts(self, memory: ConversationBufferWindowMemory, limit: int = 4) -> List[str]:
        """Достать последние ответы ассистента из memory."""
        result: List[str] = []
        for msg in reversed(memory.chat_memory.messages):
            if isinstance(msg, AIMessage):
                content = str(msg.content or "").strip()
                if content:
                    result.append(content)
                if len(result) >= limit:
                    break
        return result

    def _is_repetitive_response(self, candidate: str, recent_ai_texts: List[str]) -> bool:
        """Проверить, не является ли ответ повтором недавних ответов."""
        candidate_norm = self._normalize_repeat_text(candidate)
        if not candidate_norm:
            return False

        for prev in recent_ai_texts:
            prev_norm = self._normalize_repeat_text(prev)
            if not prev_norm:
                continue

            # Прямое включение коротких ответов — явный повтор.
            if candidate_norm == prev_norm:
                return True
            if len(candidate_norm) >= 30 and candidate_norm in prev_norm:
                return True
            if len(prev_norm) >= 30 and prev_norm in candidate_norm:
                return True

            # Похожесть по SequenceMatcher.
            similarity = SequenceMatcher(None, candidate_norm, prev_norm).ratio()
            if similarity >= self.max_repeat_similarity:
                return True

        return False
    
    def _get_memory(self, conversation_id: Optional[str] = None) -> ConversationBufferWindowMemory:
        """Получить или создать Memory для беседы
        
        Args:
            conversation_id: ID беседы (опционально)
            
        Returns:
            ConversationBufferWindowMemory для беседы
        """
        if not conversation_id:
            conversation_id = "default"
        
        if conversation_id not in self.memories:
            self.memories[conversation_id] = ConversationBufferWindowMemory(
                k=self.max_history_length,
                return_messages=True
            )
            logger.debug(f"Создана новая память для беседы {conversation_id}")
        
        return self.memories[conversation_id]

    @staticmethod
    def _related_conversation_ids(conversation_id: Optional[str]) -> List[str]:
        """Получить список связанных идентификаторов беседы (для мульти-агентных чатов)."""
        if not conversation_id:
            return []
        ids = [conversation_id]
        if "_agent_" in conversation_id:
            base_id = conversation_id.split("_agent_")[0]
            if base_id:
                ids.append(base_id)
        return ids
    
    def _load_history_from_db(self, conversation_id: str) -> None:
        """Загрузить историю сообщений из БД в Memory
        
        Args:
            conversation_id: ID беседы
        """
        try:
            memory = self._get_memory(conversation_id)
            
            # Всегда очищаем память перед загрузкой, чтобы гарантировать актуальность и избежать дубликатов
            # Особенно важно для групповых чатов, где контент меняется динамически
            memory.chat_memory.clear()
            
            # Импортируем здесь чтобы избежать циклических зависимостей
            from models.message import Message
            from sqlmodel import Session, select
            from core.database import engine
            
            # Парсим conversation_id для определения типа беседы
            # Формат: "123" - обычная беседа, "123_agent_5" - групповой чат с агентом 5
            if "_agent_" in conversation_id:
                # Групповой чат - ищем по multi_agent_conversation_id
                # Каждый агент видит ВСЕ сообщения чата для понимания контекста
                parts = conversation_id.split("_agent_")
                base_conversation_id = int(parts[0])
                
                with Session(engine) as session:
                    messages = session.exec(
                        select(Message)
                        .where(Message.multi_agent_conversation_id == base_conversation_id)
                        .where(Message.is_deleted == False)
                        .order_by(Message.created_at.asc())
                    ).all()
            else:
                # Обычная беседа - ищем по conversation_id
                try:
                    conv_id = int(conversation_id)
                    with Session(engine) as session:
                        messages = session.exec(
                            select(Message)
                            .where(Message.conversation_id == conv_id)
                            .where(Message.is_deleted == False)
                            .order_by(Message.created_at.asc())
                        ).all()
                except ValueError:
                    # conversation_id не число - пропускаем загрузку из БД
                    logger.debug(f"conversation_id {conversation_id} не является числом, пропускаем загрузку из БД")
                    return
            
            # Загружаем сообщения в Memory
            # Импортируем FileExtractionService для извлечения текста из файлов
            from services.file_extraction_service import FileExtractionService
            from models.file_attachment import FileAttachment
            file_extraction_service = FileExtractionService()
            
            for msg in messages:
                # Извлекаем текст из файлов, если они есть
                message_content = msg.content
                
                # Загружаем файлы, прикрепленные к этому сообщению
                with Session(engine) as session:
                    attachments = session.exec(
                        select(FileAttachment).where(FileAttachment.message_id == msg.id)
                    ).all()
                    
                    if attachments:
                        logger.info(f"📎 Найдено {len(attachments)} файлов для сообщения {msg.id}, извлекаем текст...")
                        file_text_parts = []
                        
                        for attachment in attachments:
                            try:
                                # Проверяем, является ли файл изображением
                                is_image = attachment.file_type and attachment.file_type.startswith("image/")
                                
                                if is_image:
                                    # Для изображений используем метаданные
                                    metadata = file_extraction_service.extract_image_metadata(attachment.file_path)
                                    formatted_text = file_extraction_service.format_image_metadata_for_message(
                                        attachment.original_filename,
                                        metadata
                                    )
                                    file_text_parts.append(formatted_text)
                                else:
                                    # Для остальных файлов извлекаем текст
                                    extracted_text = file_extraction_service.extract_text(
                                        attachment.file_path,
                                        attachment.file_type
                                    )
                                    
                                    if extracted_text:
                                        formatted_text = file_extraction_service.format_extracted_text_for_message(
                                            attachment.original_filename,
                                            extracted_text,
                                            attachment.file_size,
                                            attachment.file_type
                                        )
                                        file_text_parts.append(formatted_text)
                                    else:
                                        # Если извлечение не удалось, добавляем метаданные
                                        formatted_text = file_extraction_service.format_extracted_text_for_message(
                                            attachment.original_filename,
                                            "",
                                            attachment.file_size,
                                            attachment.file_type
                                        )
                                        file_text_parts.append(formatted_text)
                            except Exception as e:
                                logger.warning(f"Не удалось извлечь текст из файла {attachment.original_filename}: {e}", exc_info=True)
                        
                        # Добавляем извлеченный текст к содержимому сообщения
                        if file_text_parts:
                            file_text = "\n\n".join(file_text_parts)
                            message_content = file_text + "\n\n---\n\n" + message_content
                            logger.info(f"✅ Текст из файлов добавлен к сообщению {msg.id} (длина: {len(message_content)} символов)")
                
                # Добавляем сообщение в Memory с извлеченным текстом из файлов
                if message_content and str(message_content).strip():
                    if msg.is_from_user:
                        memory.chat_memory.add_user_message(message_content)
                    else:
                        # Сообщения от агентов (в групповом чате уже содержат имя)
                        memory.chat_memory.add_ai_message(message_content)
            
            if messages:
                logger.debug(f"📜 [LANGCHAIN] Загружено {len(messages)} сообщений из БД для беседы {conversation_id}")
        except Exception as e:
            logger.warning(f"Не удалось загрузить историю из БД для беседы {conversation_id}: {e}", exc_info=True)
    
    def get_message_history(self, conversation_id: str) -> List[Dict[str, str]]:
        """Получить историю сообщений для беседы в формате словарей
        
        Args:
            conversation_id: ID беседы
            
        Returns:
            Список сообщений беседы в формате [{"role": "user", "content": "..."}, ...]
        """
        memory = self._get_memory(conversation_id)
        messages = memory.chat_memory.messages
        
        result = []
        for msg in messages:
            if isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                result.append({"role": "assistant", "content": msg.content})
            elif isinstance(msg, SystemMessage):
                result.append({"role": "system", "content": msg.content})
        
        return result
    
    def _get_llm_for_model(self, model: Optional[str] = None, agent_name: Optional[str] = None, instructions: Optional[str] = None):
        """Получить LLM для конкретной модели
        
        Args:
            model: Название модели (опционально, если None используется модель из конфигурации)
            agent_name: Имя агента (для определения специальных настроек)
            instructions: Инструкции агента (для определения специальных настроек)
            
        Returns:
            ChatOpenAI экземпляр для указанной модели
        """
        openrouter_config = config.get_openrouter_config()
        model_config = config.get_model_config()
        
        max_tokens = model_config["max_tokens"]
        
        if model:
            # Создаем новый LLM с указанной моделью агента
            logger.debug(f"Используем модель агента: {model}")
            return ChatOpenAI(
                model=model,
                temperature=model_config["temperature"],
                max_tokens=max_tokens,
                api_key=self.api_key,
                base_url=openrouter_config["base_url"],
                default_headers=openrouter_config["default_headers"],
                streaming=False,
                timeout=90.0
            )
        elif max_tokens != model_config["max_tokens"]:
            # Если нужно изменить max_tokens для текущей модели
            return ChatOpenAI(
                model=model_config["model"],
                temperature=model_config["temperature"],
                max_tokens=max_tokens,
                api_key=self.api_key,
                base_url=openrouter_config["base_url"],
                default_headers=openrouter_config["default_headers"],
                streaming=False,
                timeout=30.0
            )
        return self.llm
    
    def _get_vision_llm(self, model: Optional[str] = None):
        """Получить LLM для обработки изображений (vision-модель)
        
        Args:
            model: Название модели (опционально, если None используется vision-модель из конфигурации)
            
        Returns:
            ChatOpenAI экземпляр для vision-модели
        """
        openrouter_config = config.get_openrouter_config()
        vision_model_config = config.get_vision_model_config()
        
        # Если указана конкретная модель, используем её, иначе используем vision-модель из конфигурации
        vision_model = model if model else vision_model_config["model"]
        
        return ChatOpenAI(
            model=vision_model,
            temperature=vision_model_config["temperature"],
            max_tokens=vision_model_config["max_tokens"],
            api_key=self.api_key,
            base_url=openrouter_config["base_url"],
            default_headers=openrouter_config["default_headers"],
            streaming=False,
            timeout=30.0
        )
    
    async def generate_response(
        self, 
        agent_name: str, 
        instructions: str, 
        user_message: str, 
        conversation_id: Optional[str] = None,
        model: Optional[str] = None,
        user_rules: Optional[List[str]] = None,
        image_attachments: Optional[List[Dict]] = None,
        language: Optional[str] = None
    ) -> str:
        """Генерировать ответ агента через LangChain и OpenRouter
        
        Args:
            agent_name: Имя агента
            instructions: Инструкции для агента
            user_message: Сообщение пользователя
            conversation_id: ID беседы (опционально)
            model: Название модели (опционально, если None используется модель из конфигурации)
            
        Returns:
            Ответ агента
            
        Raises:
            Exception: При ошибке генерации ответа (возвращается fallback)
        """
        # Validate image_attachments to prevent 'str' object has no attribute 'get' error
        if image_attachments is not None:
            if not isinstance(image_attachments, list):
                logger.warning(f"image_attachments is not a list, resetting to None. Type: {type(image_attachments)}")
                image_attachments = None
            else:
                # Filter out any non-dict items in image_attachments
                valid_attachments = []
                for i, att in enumerate(image_attachments):
                    if isinstance(att, dict):
                        valid_attachments.append(att)
                    else:
                        logger.warning(f"image_attachments[{i}] is not a dict, skipping. Type: {type(att)}, Value: {att}")
                image_attachments = valid_attachments if valid_attachments else None
        
        try:
            # Если есть изображения, используем vision-модель для их обработки
            # Всегда используем vision-модель из конфигурации для гарантированной поддержки изображений
            if image_attachments and len(image_attachments) > 0:
                logger.info(f"🖼️ Обнаружены изображения ({len(image_attachments)} шт.), используем vision-модель для обработки")
                # Игнорируем переданную модель, используем vision-модель из конфигурации
                llm = self._get_vision_llm(None)
            else:
                # Для текстовых запросов используем обычную модель
                llm = self._get_llm_for_model(model, agent_name, instructions)
            
            # Загружаем историю из БД если conversation_id указан
            if conversation_id:
                self._load_history_from_db(conversation_id)

            # Инструкция: персонаж сам определяет язык по сообщению и отвечает на нём
            language_instruction = (
                "ЯЗЫК ОТВЕТА: Отвечай на том же языке, на котором написал пользователь. "
                "Определи язык по содержимому его сообщения: русский → отвечай по-русски, "
                "английский → по-английски, и т.д. Всегда соответствуй языку пользователя.\n\n"
            )
            
            # Формируем системное сообщение с инструкциями
            is_multi_agent_ctx = bool(conversation_id and "_agent_" in str(conversation_id))
            system_message = self._build_system_message(
                agent_name=agent_name,
                instructions=instructions,
                has_tools=False,
                language_instruction=language_instruction,
                is_multi_agent=is_multi_agent_ctx
            )
            
            # Добавляем правила пользователя к системному сообщению, если они есть
            if user_rules and len(user_rules) > 0:
                logger.info(f"📋 Добавление {len(user_rules)} правил пользователя в системное сообщение для беседы {conversation_id}")
                logger.debug(f"📝 Правила: {user_rules}")
                rules_text = "\n\nДополнительные правила пользователя:\n"
                for i, rule in enumerate(user_rules, 1):
                    if rule.strip():  # Пропускаем пустые правила
                        rules_text += f"{i}. {rule.strip()}\n"
                system_message += rules_text
                logger.debug(f"✅ Системное сообщение содержит правила (длина: {len(system_message)} символов)")
            else:
                if user_rules is not None:
                    logger.debug(f"📋 Правил пользователя нет для беседы {conversation_id} (пустой список)")
                else:
                    logger.debug(f"📋 Правила пользователя не проверялись для беседы {conversation_id}")
            
            # Получаем Memory для беседы
            memory = self._get_memory(conversation_id)
            
            # Формируем сообщения для LangChain
            messages: List[BaseMessage] = []
            
            # ВСЕГДА принудительно обновляем системное сообщение при каждом запросе
            # Это гарантирует, что правила пользователя всегда актуальны
            # Удаляем все старые системные сообщения и добавляем новое
            old_system_messages = [m for m in memory.chat_memory.messages if isinstance(m, SystemMessage)]
            memory.chat_memory.messages = [m for m in memory.chat_memory.messages if not isinstance(m, SystemMessage)]
            
            # Добавляем новое системное сообщение с актуальными правилами
            messages.append(SystemMessage(content=system_message))
            
            # Логируем для отладки
            if user_rules:
                logger.debug(f"Системное сообщение обновлено с {len(user_rules)} правилами пользователя для беседы {conversation_id}")
            elif user_rules is not None:
                logger.debug(f"Системное сообщение обновлено без правил пользователя для беседы {conversation_id} (правила были проверены)")
            else:
                logger.debug(f"Системное сообщение обновлено для беседы {conversation_id} (правила не проверялись)")
            
            # Добавляем историю из Memory (без системного сообщения, оно уже добавлено)
            # Фильтруем системные сообщения и ограничиваем количество
            history_messages = [msg for msg in memory.chat_memory.messages if not isinstance(msg, SystemMessage)]
            max_context = config.MAX_CONTEXT_MESSAGES
            
            # ВАЖНО: Проверяем, не является ли последнее сообщение в истории дубликатом текущего сообщения.
            # В групповых чатах сообщение сохраняется в БД ДО вызова генерации, 
            # поэтому оно попадает в историю при загрузке.
            current_history = history_messages[-max_context:]
            
            # Извлекаем текст текущего сообщения пользователя для сравнения
            current_user_text = user_message
            if isinstance(user_message, list):
                text_parts = []
                for item in user_message:
                    if isinstance(item, dict):
                        if item.get("type") == "text":
                            text_parts.append(item.get("text", ""))
                    else:
                        logger.warning(f"user_message item is not a dict, converting to string. Type: {type(item)}, Value: {item}")
                        text_parts.append(str(item))
                current_user_text = " ".join(text_parts) if text_parts else ""
            
            # Если последнее сообщение в истории - это сообщение пользователя, которое
            # является подстрокой или совпадает с текущим сообщением, пропускаем его из ОТПРАВКИ (не из памяти)
            if current_history and isinstance(current_history[-1], HumanMessage):
                last_hist_text = str(current_history[-1].content)
                # В групповом чате текущее сообщение содержит инструкции, т.е. оно длиннее и начинается с текста пользователя
                if current_user_text.startswith(last_hist_text) or (len(last_hist_text) > 0 and last_hist_text in current_user_text):
                    logger.debug(f"Удалено дублирующееся сообщение пользователя из истории перед отправкой в LLM")
                    current_history.pop()
            
            for msg in current_history:
                messages.append(msg)
            
            # Добавляем текущее сообщение пользователя
            # Если есть изображения, создаем сообщение с изображениями
            if image_attachments:
                # Для моделей с vision поддерживаем формат с изображениями
                # LangChain ChatOpenAI поддерживает изображения через список content
                # Формат: [{"type": "text", "text": "..."}, {"type": "image_url", "image_url": {"url": "data:..."}}]
                content_list = []
                
                # Добавляем текстовую часть
                if user_message:
                    content_list.append({
                        "type": "text",
                        "text": user_message
                    })
                
                # Добавляем изображения
                for img_info in image_attachments:
                    if not isinstance(img_info, dict):
                        logger.warning(f"img_info is not a dict, skipping. Type: {type(img_info)}")
                        continue
                    image_data_uri = img_info.get("base64", "")
                    if image_data_uri:
                        # LangChain поддерживает изображения через формат OpenAI
                        content_list.append({
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_uri  # data URI с base64 (data:image/jpeg;base64,...)
                            }
                        })
                
                if content_list:
                    messages.append(HumanMessage(content=content_list))
                else:
                    messages.append(HumanMessage(content=user_message))
            else:
                messages.append(HumanMessage(content=user_message))
            
            # Асинхронный вызов LLM через LangChain
            actual_model = model or config.get_model_config()["model"]
            logger.info(f"📤 [LANGCHAIN] Отправляем запрос для '{agent_name}' (модель: {actual_model})")
            
            response = await llm.ainvoke(messages)
            
            # Если ответ пустой, пробуем fallback
            if not response.content or str(response.content).strip() == "":
                actual_fallback = self._get_fallback_model(actual_model) or "tngtech/deepseek-r1t2-chimera:free"
                logger.warning(f"⚠️ [LANGCHAIN] Модель {actual_model} вернула ПУСТОЙ ответ. Пробуем fallback: {actual_fallback}")
                
                fallback_response = await self._try_with_fallback_model(
                    fallback_model=actual_fallback,
                    agent_name=agent_name,
                    instructions=instructions,
                    user_message=user_message,
                    conversation_id=conversation_id,
                    user_rules=user_rules,
                    image_attachments=image_attachments,
                    language=language
                )
                
                # Если и fallback вернул пустой ответ, пробуем последний шанс - основную модель
                if not fallback_response or str(fallback_response).strip() == "":
                    ultimate_fallback = "tngtech/deepseek-r1t2-chimera:free"
                    logger.warning(f"⚠️ [LANGCHAIN] Fallback модель {actual_fallback} тоже вернула пустой ответ. Пробуем ULTIMATE fallback: {ultimate_fallback}")
                    return await self._try_with_fallback_model(
                        fallback_model=ultimate_fallback,
                        agent_name=agent_name,
                        instructions=instructions,
                        user_message=user_message,
                        conversation_id=conversation_id,
                        user_rules=user_rules,
                        image_attachments=image_attachments,
                        language=language
                    )
                return fallback_response
            
            response_text = response.content

            # Анти-повтор: если ответ почти совпадает с недавними, просим модель перефразировать,
            # сохранив стиль персонажа и смысл.
            if conversation_id and isinstance(response_text, str):
                recent_ai_texts = self._get_recent_ai_texts(memory)
                if self._is_repetitive_response(response_text, recent_ai_texts):
                    logger.info("🔁 [ANTI-REPEAT] Обнаружен повтор для '%s', выполняем retry", agent_name)
                    retry_messages = list(messages)
                    retry_messages.append(
                        HumanMessage(
                            content=(
                                "Пожалуйста, ответь иначе: сохрани характер и стиль персонажа, "
                                "но не повторяй дословно недавние формулировки. "
                                "Дай свежий ракурс по сути вопроса."
                            )
                        )
                    )
                    for _ in range(self.max_repeat_retries):
                        retry_response = await llm.ainvoke(retry_messages)
                        retry_text = str(retry_response.content or "").strip()
                        if retry_text and not self._is_repetitive_response(retry_text, recent_ai_texts):
                            response_text = retry_text
                            logger.info("✅ [ANTI-REPEAT] Получен более вариативный ответ для '%s'", agent_name)
                            break

            logger.debug(f"Получен ответ через LangChain для агента {agent_name}")
            
            # Сохраняем сообщения в Memory
            # ВАЖНО: Мы НЕ сохраняем здесь user_message повторно, так как оно уже есть в БД
            # и будет загружено при следующем вызове _load_history_from_db.
            # Сохраняем только ответ ассистента.
            if conversation_id:
                memory.chat_memory.add_ai_message(response_text)
            
            return response_text
            
        except Exception as e:
            error_message = str(e)
            error_type = type(e).__name__
            is_rate_limit = (
                OpenAIRateLimitError is not None and isinstance(e, OpenAIRateLimitError)
                or "429" in error_message
                or "rate limit" in error_message.lower()
                or "rate-limited" in error_message.lower()
            )
            if is_rate_limit:
                logger.warning(
                    "Превышен лимит запросов к модели для агента %s (модель: %s). Пробуем fallback или возвращаем сообщение пользователю.",
                    agent_name, model
                )
            else:
                logger.error(
                    f"Ошибка в generate_response для агента {agent_name} с моделью {model}: {error_type}: {error_message}",
                    exc_info=True,
                )

            # Проверяем, является ли это ошибкой подключения к API
            is_connection_error = (
                "connection error" in error_message.lower() or
                "connection timeout" in error_message.lower() or
                "connection refused" in error_message.lower() or
                "apiconnectionerror" in error_message.lower() or
                "readerror" in error_message.lower() or
                "timeout" in error_message.lower() or
                "connecterror" in error_message.lower() or
                "connection aborted" in error_message.lower() or
                "server disconnected" in error_message.lower()
            )
            
            # Если это ошибка подключения к API, пробуем использовать fallback модель
            if is_connection_error and model:
                fallback_model = self._get_fallback_model(model)
                if fallback_model and fallback_model != model:
                    logger.info(f"Обнаружена ошибка подключения к API. Пробуем fallback модель: {fallback_model} вместо {model}")
                    try:
                        return await self._try_with_fallback_model(
                            fallback_model=fallback_model,
                            agent_name=agent_name,
                            instructions=instructions,
                            user_message=user_message,
                            conversation_id=conversation_id,
                            user_rules=user_rules,
                            image_attachments=image_attachments,
                            language=language
                        )
                    except Exception as fallback_error:
                        logger.error(f"Ошибка при использовании fallback модели {fallback_model} для исправления ошибки подключения: {fallback_error}", exc_info=True)
            
            # Пытаемся использовать fallback модель при ошибке
            if model:
                fallback_model = self._get_fallback_model(model)
                if fallback_model and fallback_model != model:
                    logger.info(f"Пробуем fallback модель {fallback_model} вместо {model}")
                    try:
                        # Повторяем запрос с fallback моделью, используя ту же логику
                        return await self._try_with_fallback_model(
                            fallback_model=fallback_model,
                            agent_name=agent_name,
                            instructions=instructions,
                            user_message=user_message,
                            conversation_id=conversation_id,
                            user_rules=user_rules,
                            image_attachments=image_attachments,
                            language=language
                        )
                    except Exception as fallback_error:
                        logger.error(f"Ошибка при использовании fallback модели {fallback_model}: {fallback_error}", exc_info=True)
            
            # Если fallback не помог, возвращаем информативное сообщение об ошибке
            return self._generate_fallback_response(agent_name, user_message, error_message, error_type)
    
    async def _try_with_fallback_model(
        self,
        fallback_model: str,
        agent_name: str,
        instructions: str,
        user_message: str,
        conversation_id: Optional[str],
        user_rules: Optional[List[str]],
        image_attachments: Optional[List[Dict]],
        language: Optional[str]
    ) -> str:
        """Попытка выполнить запрос с fallback моделью
        
        Args:
            fallback_model: Fallback модель для использования
            agent_name: Имя агента
            instructions: Инструкции агента
            user_message: Сообщение пользователя
            conversation_id: ID беседы
            user_rules: Правила пользователя
            image_attachments: Вложения изображений
            language: Язык ответа
            
        Returns:
            Ответ от модели
        """
        # Validate image_attachments to prevent 'str' object has no attribute 'get' error
        if image_attachments is not None:
            if not isinstance(image_attachments, list):
                logger.warning(f"_try_with_fallback_model: image_attachments is not a list, resetting to None. Type: {type(image_attachments)}")
                image_attachments = None
            else:
                # Filter out any non-dict items in image_attachments
                valid_attachments = []
                for i, att in enumerate(image_attachments):
                    if isinstance(att, dict):
                        valid_attachments.append(att)
                    else:
                        logger.warning(f"_try_with_fallback_model: image_attachments[{i}] is not a dict, skipping. Type: {type(att)}, Value: {att}")
                image_attachments = valid_attachments if valid_attachments else None
        
        # Используем ту же логику, что и в основном методе
        if image_attachments and len(image_attachments) > 0:
            llm = self._get_vision_llm(fallback_model)
        else:
            llm = self._get_llm_for_model(fallback_model, agent_name, instructions)
        
        # Загружаем историю если нужно
        if conversation_id:
            self._load_history_from_db(conversation_id)

        # Персонаж сам определяет язык по сообщению
        language_instruction = (
            "ЯЗЫК ОТВЕТА: Отвечай на том же языке, на котором написал пользователь. "
            "Определи язык по содержимому его сообщения: русский → по-русски, "
            "английский → по-английски, и т.д. Всегда соответствуй языку пользователя.\n\n"
        )

        # Формируем системное сообщение
        is_multi_agent_ctx = bool(conversation_id and "_agent_" in str(conversation_id))
        system_message = self._build_system_message(
            agent_name=agent_name,
            instructions=instructions,
            has_tools=False,
            language_instruction=language_instruction,
            is_multi_agent=is_multi_agent_ctx
        )
        
        if user_rules and len(user_rules) > 0:
            rules_text = "\n\nДополнительные правила пользователя:\n"
            for i, rule in enumerate(user_rules, 1):
                if rule.strip():
                    rules_text += f"{i}. {rule.strip()}\n"
            system_message += rules_text
        
        # Получаем память и формируем сообщения
        memory = self._get_memory(conversation_id)
        messages: List[BaseMessage] = []
        
        # Удаляем старые системные сообщения
        old_system_messages = [m for m in memory.chat_memory.messages if isinstance(m, SystemMessage)]
        if old_system_messages:
            memory.chat_memory.messages = [m for m in memory.chat_memory.messages if not isinstance(m, SystemMessage)]
        
        messages.append(SystemMessage(content=system_message))
        
        # Добавляем историю
        for msg in memory.chat_memory.messages:
            messages.append(msg)
        
        # Добавляем текущее сообщение пользователя
        if image_attachments and len(image_attachments) > 0:
            content = []
            for img_att in image_attachments:
                if not isinstance(img_att, dict):
                    logger.warning(f"img_att is not a dict, skipping. Type: {type(img_att)}")
                    continue
                if img_att.get("type") == "image_url" and img_att.get("image_url"):
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": img_att["image_url"]}
                    })
            if isinstance(user_message, str):
                content.insert(0, {"type": "text", "text": user_message})
            elif isinstance(user_message, list):
                text_parts = []
                for item in user_message:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                if text_parts:
                    content.insert(0, {"type": "text", "text": " ".join(text_parts)})
            messages.append(HumanMessage(content=content))
        else:
            if isinstance(user_message, list):
                text_parts = []
                for item in user_message:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                user_message = " ".join(text_parts) if text_parts else str(user_message)
            messages.append(HumanMessage(content=user_message))
        
        # Вызываем модель
        response = await llm.ainvoke(messages)
        response_text = response.content
        
        # Сохраняем в память
        if conversation_id:
            user_message_text = user_message
            if isinstance(user_message, list):
                text_parts = []
                for item in user_message:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                user_message_text = " ".join(text_parts) if text_parts else str(user_message)
            
            memory.chat_memory.add_user_message(user_message_text)
            memory.chat_memory.add_ai_message(response_text)
        
        logger.info(f"Успешно использована fallback модель {fallback_model}")
        return response_text
    
    def _get_fallback_model(self, current_model: str) -> Optional[str]:
        """Получить fallback модель для текущей модели
        
        Args:
            current_model: Текущая модель
            
        Returns:
            Fallback модель или None
        """
        fallback_map = {
            # DeepSeek fallbacks
            "tngtech/deepseek-r1t2-chimera:free": "arcee-ai/trinity-large-preview:free",
            "arcee-ai/trinity-large-preview:free": "tngtech/deepseek-r1t-chimera:free",
            "tngtech/deepseek-r1t-chimera:free": "deepseek/deepseek-r1-0528:free",
            "deepseek/deepseek-r1-0528:free": "tngtech/tng-r1t-chimera:free",
            "tngtech/tng-r1t-chimera:free": "tngtech/deepseek-r1t2-chimera:free",
        }
        return fallback_map.get(current_model)
    
    def _get_cross_provider_fallback(self, current_model: str) -> Optional[str]:
        """Получить fallback модель от другого провайдера при ограничениях региона
        
        Используется когда текущая модель недоступна из-за географических ограничений.
        
        Args:
            current_model: Текущая модель
            
        Returns:
            Fallback модель или None
        """
        # Возвращаем основную модель DeepSeek как fallback
        return "tngtech/deepseek-r1t2-chimera:free"
    
    def _generate_fallback_response(self, agent_name: str, user_message: str, error_message: str = "", error_type: str = "") -> str:
        """Генерировать ответ-заглушку на основе имени агента
        
        Args:
            agent_name: Имя агента
            user_message: Сообщение пользователя
            error_message: Сообщение об ошибке
            error_type: Тип ошибки
            
        Returns:
            Ответ-заглушка
        """
        # Формируем более информативное сообщение об ошибке
        if error_message:
            # Упрощаем сообщение об ошибке для пользователя
            if "rate limit" in error_message.lower() or "429" in error_message:
                return f"Извините, превышен лимит запросов к API. Пожалуйста, подождите немного и попробуйте снова."
            elif "model" in error_message.lower() and ("not found" in error_message.lower() or "invalid" in error_message.lower()):
                return f"Извините, выбранная модель временно недоступна. Пожалуйста, попробуйте позже."
            elif "timeout" in error_message.lower():
                return f"Извините, запрос занял слишком много времени. Пожалуйста, попробуйте снова."
            elif "api key" in error_message.lower() or "authentication" in error_message.lower():
                return f"Извините, проблема с аутентификацией API. Пожалуйста, обратитесь к администратору."
            elif "connection error" in error_message.lower() or "connection timeout" in error_message.lower() or "connection refused" in error_message.lower():
                return f"Извините, произошла ошибка подключения к API. Пожалуйста, попробуйте еще раз. Возможно, модель временно недоступна или возникла сетевая проблема."
            elif "apiconnectionerror" in error_message.lower():
                return f"Извините, произошла ошибка подключения к API. Пожалуйста, попробуйте еще раз. Возможно, модель временно недоступна или возникла сетевая проблема."
            else:
                # Для других ошибок показываем общее сообщение
                return f"Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз."
        
        return f"Извините, в данный момент сервис временно недоступен. Агент {agent_name} не может ответить на ваше сообщение. Пожалуйста, попробуйте позже."
    
    def clear_conversation_history(self, conversation_id: str) -> None:
        """Очистить историю сообщений для конкретной беседы
        
        Args:
            conversation_id: ID беседы
        """
        if conversation_id in self.memories:
            self.memories[conversation_id].clear()
            logger.debug(f"История сообщений для беседы {conversation_id} очищена")
        for related_id in self._related_conversation_ids(conversation_id):
            self.last_detected_language.pop(related_id, None)
        else:
            logger.debug(f"Память для беседы {conversation_id} не найдена, ничего не очищено")
    
    def clear_conversation_system_message(self, conversation_id: str) -> None:
        """Очистить только системное сообщение для конкретной беседы
        
        Это позволяет обновить системное сообщение с новыми правилами пользователя
        без удаления всей истории сообщений.
        
        Args:
            conversation_id: ID беседы
        """
        if conversation_id in self.memories:
            memory = self.memories[conversation_id]
            # Удаляем только системные сообщения, сохраняя остальную историю
            memory.chat_memory.messages = [
                msg for msg in memory.chat_memory.messages 
                if not isinstance(msg, SystemMessage)
            ]
            logger.debug(f"Системное сообщение для беседы {conversation_id} очищено")
        for related_id in self._related_conversation_ids(conversation_id):
            self.last_detected_language.pop(related_id, None)
        else:
            logger.debug(f"Память для беседы {conversation_id} не найдена, ничего не очищено")
    
    async def generate_response_with_tools(
        self, 
        agent_name: str, 
        instructions: str, 
        user_message: str, 
        tools: Optional[List[Any]] = None,
        conversation_id: Optional[str] = None,
        model: Optional[str] = None,
        user_rules: Optional[List[str]] = None,
        language: Optional[str] = None  # поддержка аргумента language для совместимости с вызовом
    ) -> str:
        """Генерировать ответ агента с использованием LangChain инструментов
        
        Args:
            agent_name: Имя агента
            instructions: Инструкции для агента
            user_message: Сообщение пользователя
            tools: Список LangChain инструментов (BaseTool или callable)
            conversation_id: ID беседы (опционально)
            model: Название модели (опционально, если None используется модель из конфигурации)
            
        Returns:
            Ответ агента
            
        Note:
            Если tools предоставлены, LLM может вызывать инструменты для получения дополнительной информации
        """
        try:
            # Получаем LLM для указанной модели
            llm = self._get_llm_for_model(model, agent_name, instructions)
            
            # Загружаем историю из БД если conversation_id указан
            if conversation_id:
                self._load_history_from_db(conversation_id)
            
            # Персонаж сам определяет язык по сообщению
            language_instruction = (
                "ЯЗЫК ОТВЕТА: Отвечай на том же языке, на котором написал пользователь. "
                "Определи язык по содержимому его сообщения: русский → по-русски, "
                "английский → по-английски, и т.д. Всегда соответствуй языку пользователя.\n\n"
            )

            has_tools = tools and len(tools) > 0
            is_multi_agent_ctx = bool(conversation_id and "_agent_" in str(conversation_id))
            system_message = self._build_system_message(
                agent_name=agent_name,
                instructions=instructions,
                has_tools=has_tools,
                language_instruction=language_instruction,
                is_multi_agent=is_multi_agent_ctx
            )
            
            # Добавляем правила пользователя к системному сообщению, если они есть
            if user_rules and len(user_rules) > 0:
                logger.info(f"📋 Добавление {len(user_rules)} правил пользователя в системное сообщение для беседы {conversation_id}")
                logger.debug(f"📝 Правила: {user_rules}")
                rules_text = "\n\nДополнительные правила пользователя:\n"
                for i, rule in enumerate(user_rules, 1):
                    if rule.strip():  # Пропускаем пустые правила
                        rules_text += f"{i}. {rule.strip()}\n"
                system_message += rules_text
                logger.debug(f"✅ Системное сообщение содержит правила (длина: {len(system_message)} символов)")
            else:
                if user_rules is not None:
                    logger.debug(f"📋 Правил пользователя нет для беседы {conversation_id} (пустой список)")
                else:
                    logger.debug(f"📋 Правила пользователя не проверялись для беседы {conversation_id}")
            
            # Получаем Memory для беседы
            memory = self._get_memory(conversation_id)
            
            # Формируем сообщения для LangChain
            messages: List[BaseMessage] = []
            
            # ВСЕГДА принудительно обновляем системное сообщение при каждом запросе
            # Это гарантирует, что правила пользователя всегда актуальны
            # Удаляем все старые системные сообщения и добавляем новое
            old_system_messages = [m for m in memory.chat_memory.messages if isinstance(m, SystemMessage)]
            memory.chat_memory.messages = [m for m in memory.chat_memory.messages if not isinstance(m, SystemMessage)]
            
            # Добавляем новое системное сообщение с актуальными правилами
            messages.append(SystemMessage(content=system_message))
            
            # Логируем для отладки
            if user_rules:
                logger.debug(f"Системное сообщение обновлено с {len(user_rules)} правилами пользователя для беседы {conversation_id}")
            elif user_rules is not None:
                logger.debug(f"Системное сообщение обновлено без правил пользователя для беседы {conversation_id} (правила были проверены)")
            else:
                logger.debug(f"Системное сообщение обновлено для беседы {conversation_id} (правила не проверялись)")
            
            # Добавляем историю из Memory (без системного сообщения)
            history_messages = [msg for msg in memory.chat_memory.messages if not isinstance(msg, SystemMessage)]
            max_context = config.MAX_CONTEXT_MESSAGES
            for msg in history_messages[-max_context:]:
                messages.append(msg)
            
            # Добавляем текущее сообщение пользователя
            messages.append(HumanMessage(content=user_message))
            
            # Если есть инструменты, привязываем их к LLM
            if tools and len(tools) > 0:
                logger.debug(f"[TOOLS] generate_response_with_tools: агент={agent_name}, tools={[t.name if hasattr(t,'name') else str(t) for t in tools]}")
                logger.info(f"🔧 Используем {len(tools)} инструментов для агента {agent_name}: {[t.name if hasattr(t, 'name') else str(t) for t in tools]}")
                try:
                    # Привязываем инструменты к LLM
                    logger.debug(f"🔗 Привязываем {len(tools)} инструментов к LLM...")
                    llm_with_tools = llm.bind_tools(tools)
                    logger.debug(f"✅ Инструменты привязаны. Вызываем LLM...")
                    # Вызываем LLM с инструментами
                    response = await llm_with_tools.ainvoke(messages)
                    logger.debug(f"✅ LLM ответил. Проверяем tool_calls...")
                    
                    # Логируем, есть ли tool_calls в ответе
                    has_tool_calls = hasattr(response, 'tool_calls') and response.tool_calls
                    logger.debug(f"🔍 LLM ответил с tool_calls: {has_tool_calls}")
                    if has_tool_calls:
                        logger.info(f"📞 LLM запросил вызов {len(response.tool_calls)} инструментов: {[tc.get('name', 'unknown') if isinstance(tc, dict) else getattr(tc, 'name', 'unknown') for tc in response.tool_calls]}")
                    else:
                        logger.warning(f"⚠️ LLM НЕ вызвал инструменты. Ответ LLM (первые 500 символов): {response.content[:500] if hasattr(response, 'content') else 'НЕТ АТРИБУТА content'}")
                        logger.debug(f"📋 Доступные инструменты: {[tool.name for tool in tools if hasattr(tool, 'name')]}")
                    
                    # Проверяем, нужны ли вызовы инструментов (в LangChain 0.3.x это tool_calls в response)
                    if has_tool_calls:
                        logger.debug(f"🔄 LLM запросил вызов {len(response.tool_calls)} инструментов")
                        # Создаем словарь инструментов для быстрого поиска
                        tools_dict = {tool.name: tool for tool in tools if hasattr(tool, 'name')}
                        logger.debug(f"📚 Словарь инструментов: {list(tools_dict.keys())}")
                        
                        tool_results = []
                        logger.debug(f"🔄 Начинаем обработку {len(response.tool_calls)} вызовов инструментов...")
                        for i, tool_call in enumerate(response.tool_calls):
                            logger.debug(f"🔄 Обрабатываем вызов {i+1}/{len(response.tool_calls)}: {type(tool_call)}")
                            # Извлекаем имя инструмента и аргументы
                            if isinstance(tool_call, dict):
                                tool_name = tool_call.get('name', '')
                                tool_args = tool_call.get('args', {})
                            else:
                                tool_name = getattr(tool_call, 'name', '')
                                tool_args = getattr(tool_call, 'args', {})
                            
                            logger.info(f"🔧 Вызов инструмента: {tool_name} с аргументами: {tool_args}")
                            
                            tool = tools_dict.get(tool_name) if tool_name else None
                            if not tool:
                                # Пытаемся найти по индексу или имени
                                tool = next((t for t in tools if hasattr(t, 'name') and t.name == tool_name), None)
                            
                            if tool:
                                try:
                                    # Для LangChain инструментов используем правильный метод вызова
                                    # Проверяем, является ли это BaseTool из LangChain
                                    if hasattr(tool, 'ainvoke'):
                                        # Асинхронный вызов LangChain инструмента
                                        # Если tool_args - это словарь, передаем его как есть
                                        if isinstance(tool_args, dict):
                                            result = await tool.ainvoke(tool_args)
                                        else:
                                            # Если это строка (для инструментов с одним параметром)
                                            result = await tool.ainvoke({"query": tool_args} if isinstance(tool_args, str) else tool_args)
                                    elif hasattr(tool, 'invoke'):
                                        # Синхронный вызов
                                        if isinstance(tool_args, dict):
                                            result = tool.invoke(tool_args)
                                        else:
                                            result = tool.invoke({"query": tool_args} if isinstance(tool_args, str) else tool_args)
                                    elif hasattr(tool, 'arun'):
                                        # Старый метод async run
                                        result = await tool.arun(**tool_args) if isinstance(tool_args, dict) else await tool.arun(tool_args)
                                    elif hasattr(tool, 'run'):
                                        # Старый метод sync run
                                        result = tool.run(**tool_args) if isinstance(tool_args, dict) else tool.run(tool_args)
                                    elif callable(tool):
                                        # Обычная функция
                                        result = tool(**tool_args) if isinstance(tool_args, dict) else tool(tool_args)
                                    else:
                                        result = str(tool)
                                    
                                    # Форматируем результат инструмента более естественно
                                    tool_results.append(f"{result}")
                                    logger.info(f"✅ Успешно вызван инструмент {tool_name}, результат (первые 200 символов): {str(result)[:200]}...")
                                except Exception as e:
                                    logger.error(f"Ошибка при вызове инструмента {tool_name}: {e}", exc_info=True)
                                    tool_results.append(f"Ошибка при вызове инструмента {tool_name}: {str(e)}")
                            else:
                                logger.warning(f"❌ Инструмент {tool_name} не найден в списке доступных инструментов. Доступные: {list(tools_dict.keys())}")
                                tool_results.append(f"Инструмент {tool_name} недоступен")
                        
                        # Если есть результаты инструментов, отправляем их обратно в LLM для финального ответа
                        if tool_results:
                            logger.debug(f"📤 Отправляем {len(tool_results)} результатов инструментов обратно в LLM для финального ответа...")
                            
                            # Логируем результаты инструментов перед отправкой в LLM
                            html_results = []
                            for i, tool_result in enumerate(tool_results):
                                # Проверяем наличие HTML-тегов (div, span, class=)
                                has_html = (
                                    '<div' in str(tool_result) or 
                                    '<a ' in str(tool_result) or 
                                    '<span' in str(tool_result) or
                                    'class=' in str(tool_result)
                                )
                                logger.info(f"📋 Результат инструмента {i+1} содержит HTML: {has_html}")
                                if has_html:
                                    logger.info(f"📋 HTML-результат (первые 500 символов): {str(tool_result)[:500]}...")
                                    html_results.append(str(tool_result))
                            
                            # КРИТИЧЕСКИ ВАЖНО: Если результат инструмента содержит HTML (например, от web_search, currency_converter, timer, reminder),
                            # возвращаем его напрямую БЕЗ отправки в LLM, чтобы гарантировать сохранение HTML-разметки
                            if html_results:
                                logger.info(f"✅ Обнаружен HTML в результате инструмента. Возвращаем HTML напрямую, минуя LLM.")
                                # Объединяем все HTML-результаты
                                response_text = "\n".join(html_results)
                                logger.info(f"✅ Возвращаем HTML-результат напрямую (длина: {len(response_text)} символов)")
                            else:
                                # Если HTML нет, отправляем в LLM как обычно
                                logger.debug(f"📤 HTML не обнаружен, отправляем результаты в LLM для обработки...")
                                # Добавляем ответ LLM и результаты инструментов в сообщения
                                messages_with_results = messages.copy()
                                messages_with_results.append(response)  # Добавляем ответ от LLM с tool_calls
                                
                                for i, tool_result in enumerate(tool_results):
                                    tool_call = response.tool_calls[i] if i < len(response.tool_calls) else {}
                                    tool_id = tool_call.get('id', f'tool_call_{i}') if isinstance(tool_call, dict) else getattr(tool_call, 'id', f'tool_call_{i}')
                                    logger.debug(f"📤 Добавляем результат инструмента {i+1} с tool_call_id: {tool_id}")
                                    logger.debug(f"📤 Результат инструмента (первые 500 символов): {tool_result[:500]}...")
                                    tool_msg = ToolMessage(content=tool_result, tool_call_id=tool_id)
                                    messages_with_results.append(tool_msg)
                                    logger.debug(f"📤 ToolMessage создан: type={type(tool_msg)}, content_length={len(tool_result)}")
                                
                                # Получаем финальный ответ от LLM с результатами инструментов
                                logger.debug(f"🔄 Запрашиваем финальный ответ от LLM с результатами инструментов...")
                                logger.debug(f"🔄 Всего сообщений для финального запроса: {len(messages_with_results)}")
                                logger.debug(f"🔄 Последние 3 сообщения: {[type(m).__name__ for m in messages_with_results[-3:]]}")
                                
                                final_response = await llm_with_tools.ainvoke(messages_with_results)
                                response_text = final_response.content
                                
                                # Удаляем markdown-блоки ```html ... ``` если они есть
                                if isinstance(response_text, str):
                                    import re
                                    response_text = response_text.strip()
                                    if response_text.lower().startswith("```html"):
                                        response_text = re.sub(r"^```html\s*", "", response_text, flags=re.IGNORECASE)
                                        response_text = re.sub(r"\s*```$", "", response_text)
                                    # Удаляем оставшиеся блоки ``` в начале и конце
                                    response_text = re.sub(r"^```\s*", "", response_text)
                                    response_text = re.sub(r"\s*```$", "", response_text)
                                
                                # Проверка на пустой ответ
                                if not response_text or (isinstance(response_text, str) and not response_text.strip()):
                                    logger.warning(f"⚠️ LLM вернул пустой ответ. Используем fallback.")
                                    # Fallback для инструментов: если результата нет/пусто — возвращаем понятное сообщение
                                    if tool_results:
                                        response_text = f"Результат инструмента: {tool_results[0]}"
                                    else:
                                        response_text = "Извините, не удалось сгенерировать ответ. Попробуйте переформулировать запрос."
                                
                                logger.info(f"✅ Получен финальный ответ от LLM (первые 500 символов): {response_text[:500] if response_text else 'ПУСТОЙ ОТВЕТ'}...")
                        else:
                            # Если инструментов нет (или LLM их не вызвал), используем исходный ответ LLM
                            logger.warning(f"⚠️ Нет результатов инструментов, используем исходный ответ LLM")
                            response_text = response.content
                    else:
                        # LangChain не вернул tool_calls — пытаемся аккуратно вытащить явный JSON с полем "tool"
                        # ВАЖНО: этот fallback не должен ломаться, если ответ — не JSON (например, обычный текст или JSON без поля tool)
                        tools_dict = {tool.name: tool for tool in tools if hasattr(tool, "name")}
                        parsed_tool_result = None
                        try:
                            import json
                            import re

                            raw_content = response.content if isinstance(response.content, str) else ""
                            content_stripped = raw_content.strip()

                            # Убираем markdown-обёртки ```json ... ``` если они есть
                            if content_stripped.lower().startswith("```json"):
                                # удаляем первую строку ```json и завершающие ```
                                content_stripped = re.sub(r"^```json\s*", "", content_stripped, flags=re.IGNORECASE)
                                content_stripped = re.sub(r"\s*```$", "", content_stripped)
                            
                            # Убираем markdown-обёртки ```html ... ``` если они есть
                            if content_stripped.lower().startswith("```html"):
                                # удаляем первую строку ```html и завершающие ```
                                content_stripped = re.sub(r"^```html\s*", "", content_stripped, flags=re.IGNORECASE)
                                content_stripped = re.sub(r"\s*```$", "", content_stripped)
                            
                            # Убираем оставшиеся блоки ``` в начале и конце (на случай других форматов)
                            content_stripped = re.sub(r"^```\s*", "", content_stripped)
                            content_stripped = re.sub(r"\s*```$", "", content_stripped)

                            # Пытаемся распарсить JSON только если строка начинается с { или [
                            if content_stripped.startswith("{") or content_stripped.startswith("["):
                                parsed = json.loads(content_stripped)
                            else:
                                parsed = None

                            if isinstance(parsed, dict) and parsed.get("tool") in tools_dict:
                                tool_name = parsed.get("tool")
                                tool_args = {k: v for k, v in parsed.items() if k != "tool"}
                                logger.info(f"🔧 [FALLBACK] Выполняю инструмент {tool_name} из JSON-ответа LLM: {tool_args}")
                                tool = tools_dict[tool_name]
                                if hasattr(tool, "ainvoke"):
                                    parsed_tool_result = await tool.ainvoke(tool_args)
                                elif hasattr(tool, "invoke"):
                                    parsed_tool_result = tool.invoke(tool_args)
                                elif hasattr(tool, "arun"):
                                    parsed_tool_result = await tool.arun(**tool_args)
                                elif hasattr(tool, "run"):
                                    parsed_tool_result = tool.run(tool_args) if not isinstance(tool_args, dict) else tool.run(**tool_args)
                                elif callable(tool):
                                    parsed_tool_result = tool(tool_args) if not isinstance(tool_args, dict) else tool(**tool_args)
                                else:
                                    parsed_tool_result = f"Инструмент {tool_name} не поддерживает вызов"
                                logger.info(f"✅ [FALLBACK] Результат инструмента {tool_name}: {str(parsed_tool_result)[:200]}")
                        except Exception as e:
                            # Это только вспомогательный fallback: не считаем его критичной ошибкой и не засоряем логи предупреждениями
                            logger.debug(f"[FALLBACK] Не удалось разобрать JSON для инструмента: {e}")
                        
                        if parsed_tool_result is not None:
                            response_text = str(parsed_tool_result)
                        else:
                            # Оставляем исходный ответ LLM без изменений
                            response_text = response.content
                except Exception as e:
                    logger.error(f"Ошибка при работе с инструментами для агента {agent_name}: {e}", exc_info=True)
                    # Fallback к обычной генерации
                    logger.debug(f"Переход на обычную генерацию без инструментов для агента {agent_name}")
                    response = await llm.ainvoke(messages)
                    response_text = response.content
            else:
                # Если инструментов нет, используем обычную генерацию
                logger.debug(f"Инструменты не предоставлены, используется обычная генерация для агента {agent_name}")
                response = await llm.ainvoke(messages)
            # Если ответ пустой, считаем это ошибкой и пробуем fallback
            if not response.content or str(response.content).strip() == "":
                actual_fallback = self._get_fallback_model(actual_model) or "tngtech/deepseek-r1t2-chimera:free"
                logger.warning(f"⚠️ [LANGCHAIN] Модель {actual_model} вернула ПУСТОЙ ответ для агента {agent_name}. Пробуем fallback: {actual_fallback}")
                
                fallback_response = await self._try_with_fallback_model(
                    fallback_model=actual_fallback,
                    agent_name=agent_name,
                    instructions=instructions,
                    user_message=user_message,
                    conversation_id=conversation_id,
                    user_rules=user_rules,
                    image_attachments=None,
                    language=language
                )
                
                # Если и fallback вернул пустой ответ, пробуем последний шанс - основную модель
                if not fallback_response or str(fallback_response).strip() == "":
                    ultimate_fallback = "tngtech/deepseek-r1t2-chimera:free"
                    logger.warning(f"⚠️ [LANGCHAIN] Fallback модель {actual_fallback} тоже вернула пустой ответ. Пробуем ULTIMATE fallback: {ultimate_fallback}")
                    return await self._try_with_fallback_model(
                        fallback_model=ultimate_fallback,
                        agent_name=agent_name,
                        instructions=instructions,
                        user_message=user_message,
                        conversation_id=conversation_id,
                        user_rules=user_rules,
                        image_attachments=None,
                        language=language
                    )
                return fallback_response

            response_text = response.content # Ensure response_text is set for the next check
            
            logger.debug(f"Получен ответ через LangChain (с инструментами) для агента {agent_name}")
            
            # Финальная проверка на пустой ответ
            if not response_text or (isinstance(response_text, str) and not response_text.strip()):
                logger.error(f"❌ КРИТИЧЕСКАЯ ОШИБКА: Финальный ответ пустой для агента {agent_name}!")
                response_text = "Извините, произошла ошибка при генерации ответа. Попробуйте переформулировать запрос."
            
            # Сохраняем сообщения в Memory
            if conversation_id:
                memory.chat_memory.add_user_message(user_message)
                memory.chat_memory.add_ai_message(response_text)
            
            return response_text
            
        except Exception as e:
            error_message = str(e)
            error_type = type(e).__name__
            logger.error(f"Ошибка в generate_response_with_tools для агента {agent_name} с моделью {model}: {error_type}: {error_message}", exc_info=True)
            
            # Проверяем, является ли это ошибкой подключения к API
            is_connection_error = (
                "connection error" in error_message.lower() or
                "connection timeout" in error_message.lower() or
                "connection refused" in error_message.lower() or
                "apiconnectionerror" in error_message.lower() or
                "readerror" in error_message.lower() or
                "timeout" in error_message.lower() or
                "connecterror" in error_message.lower() or
                "connection aborted" in error_message.lower() or
                "server disconnected" in error_message.lower()
            )
            
            # Если это ошибка подключения к API и указана модель, пробуем использовать fallback
            if is_connection_error and model:
                fallback_model = self._get_fallback_model(model)
                if fallback_model and fallback_model != model:
                    logger.info(f"Обнаружена ошибка подключения к API в generate_response_with_tools. Пробуем fallback модель: {fallback_model} вместо {model}")
                    try:
                        return await self._try_with_fallback_model(
                            fallback_model=fallback_model,
                            agent_name=agent_name,
                            instructions=instructions,
                            user_message=user_message,
                            conversation_id=conversation_id,
                            user_rules=user_rules,
                            image_attachments=None,  # В tools-методе изображения не поддерживаются
                            language=language
                        )
                    except Exception as fallback_error:
                        logger.error(f"Ошибка при использовании fallback модели {fallback_model} для исправления ошибки подключения: {fallback_error}", exc_info=True)
            
            return self._generate_fallback_response(agent_name, user_message, error_message, error_type)
    
    async def test_connection(self) -> bool:
        """Тестировать подключение к OpenRouter API через LangChain
        
        Returns:
            True, если подключение успешно, False в противном случае
        """
        try:
            logger.debug(f"Тестируем подключение к OpenRouter API через LangChain с ключом: {self.api_key[:20]}...")
            
            # Создаем простое тестовое сообщение
            test_messages = [HumanMessage(content="Привет!")]
            
            # Асинхронный вызов через LangChain
            response = await self.llm.ainvoke(test_messages)
            response_text = response.content
            
            logger.info(f"Подключение к OpenRouter API через LangChain успешно. Ответ: {response_text}")
            return True
        except Exception as e:
            logger.error(f"Ошибка подключения к OpenRouter API через LangChain: {e} (тип: {type(e).__name__})", exc_info=True)
            return False