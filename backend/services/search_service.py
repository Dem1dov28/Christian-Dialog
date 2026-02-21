from typing import List, Optional, Dict, Any, Set
from sqlmodel import Session, select, or_, and_
import re
import logging
from html import unescape

from services.base_service import BaseService
from models.conversation import Conversation
from models.user import User

logger = logging.getLogger(__name__)

DEFAULT_CHANNEL_AVATAR = "/images/agents/AI_Broadcast.png"


class SearchService(BaseService):
    """Сервис для поиска по чатам и сообщениям"""
    
    def calculate_relevance_score(self, text: str, query: str) -> float:
        """
        Умный поиск с учетом релевантности.
        Использует комбинированный подход для оценки соответствия текста запросу.
        """
        if not text or not query:
            return 0.0
        
        text_lower = text.lower()
        query_lower = query.lower()
        
        # Убираем знаки препинания для лучшего сравнения
        text_clean = re.sub(r'[^\w\s]', ' ', text_lower)
        query_clean = re.sub(r'[^\w\s]', ' ', query_lower)
        
        # 1. Точное совпадение всей фразы (с учетом регистра) - 100 баллов
        if query in text:
            if text.startswith(query):
                return 100.0
            elif f" {query}" in text:
                return 95.0
            else:
                return 90.0
        
        # 2. Точное совпадение всей фразы (без учета регистра) - 85 баллов
        if query_lower in text_lower:
            if text_lower.startswith(query_lower):
                return 85.0
            elif f" {query_lower}" in text_lower:
                return 80.0
            else:
                return 75.0
        
        # 3. Поиск по словам с умной оценкой
        query_words = query_clean.split()
        text_words = text_clean.split()
        
        # Фильтруем очень короткие слова (1-2 символа) - предлоги, союзы
        stop_words = {'в', 'к', 'на', 'от', 'из', 'по', 'за', 'и', 'а', 'но', 'да', 'или', 'же', 'ли'}
        significant_query_words = [w for w in query_words if len(w) > 2 and w not in stop_words]
        
        if not significant_query_words:
            # Если все слова короткие/стоп-слова, используем оригинальные
            significant_query_words = query_words
        
        if not significant_query_words:
            return 0.0
        
        # Подсчитываем совпадения
        exact_matches = 0
        partial_matches = 0
        
        for q_word in significant_query_words:
            found_exact = False
            found_partial = False
            
            for t_word in text_words:
                if q_word == t_word:
                    exact_matches += 1
                    found_exact = True
                    break
                elif q_word in t_word or t_word in q_word:
                    if not found_partial:
                        partial_matches += 1
                        found_partial = True
        
        total_words = len(significant_query_words)
        exact_ratio = exact_matches / total_words if total_words > 0 else 0
        partial_ratio = partial_matches / total_words if total_words > 0 else 0
        total_ratio = (exact_matches + partial_matches) / total_words if total_words > 0 else 0
        
        # Система оценки
        if exact_ratio >= 1.0:
            return 70.0
        elif total_ratio >= 0.8:
            score = 60.0 + (exact_ratio * 10.0)
            return score
        elif total_ratio >= 0.5:
            score = 40.0 + (total_ratio * 25.0)
            return score
        else:
            return 0.0
    
    def enhance_search_results(self, results: List[Any], query: str, result_type: str) -> List[Dict[str, Any]]:
        """Улучшает результаты поиска с релевантностью и дополнительной информацией"""
        enhanced = []
        
        for result in results:
            if result_type == "conversation":
                relevance = self.calculate_relevance_score(result.title, query)
                enhanced.append({
                    "id": result.id,
                    "title": result.title,
                    "updated_at": result.updated_at,
                    "is_group": getattr(result, 'is_group', False),
                    "relevance_score": relevance,
                    "type": "conversation"
                })
            elif result_type == "message":
                sanitized_content = self._sanitize_message_content(result.content)
                relevance = self.calculate_relevance_score(sanitized_content, query)
                enhanced.append({
                    "id": result.id,
                    "content": sanitized_content,
                    "created_at": result.created_at,
                    "is_from_user": result.is_from_user,
                    "agent_name": getattr(result, 'agent_name', ''),
                    "conversation_id": result.conversation_id,
                    "conversation_title": getattr(result, 'conversation_title', ''),
                    "is_pinned": getattr(result, 'is_pinned', False),
                    "relevance_score": relevance,
                    "type": "message"
                })
        
        return sorted(enhanced, key=lambda x: x["relevance_score"], reverse=True)
    
    def _escape_sql_like_pattern(self, text: str) -> str:
        """Экранирует специальные символы для SQL LIKE/ILIKE паттернов.
        
        Экранирует символы, которые имеют специальное значение в SQL LIKE:
        - % (любые символы) -> \\%
        - _ (один символ) -> \\_  
        - \\ (экранирующий символ) -> \\
        
        Кавычки (" и ') и другие специальные символы (скобки, знаки препинания и т.д.)
        не требуют экранирования для LIKE и обрабатываются как обычный текст.
        Это позволяет искать фразы с кавычками, скобками и другими знаками препинания.
        """
        if not text:
            return text
        
        # Экранируем обратный слэш первым (чтобы не экранировать уже экранированные символы)
        text = text.replace("\\", "\\\\")
        # Экранируем специальные символы SQL LIKE
        text = text.replace("%", "\\%")
        text = text.replace("_", "\\_")
        
        # Кавычки и другие символы не нужно экранировать для LIKE,
        # но они могут быть в тексте, поэтому оставляем как есть
        
        return text
    
    def build_message_search_conditions(self, query: str) -> List:
        """Создает условия поиска для сообщений (гибкий поиск для глобального поиска)"""
        from models.message import Message
        
        # Экранируем специальные символы SQL
        query_escaped = self._escape_sql_like_pattern(query)
        query_lower = query.lower()
        query_lower_escaped = self._escape_sql_like_pattern(query_lower)
        words = query.split()
        
        search_conditions = []
        
        # 1. Точное совпадение с учетом регистра (высший приоритет)
        search_conditions.append(Message.content.ilike(f"{query_escaped}%"))
        search_conditions.append(Message.content.ilike(f"%{query_escaped}%"))
        
        # 2. Поиск по словам с учетом регистра
        for word in words:
            if len(word) > 2:
                word_escaped = self._escape_sql_like_pattern(word)
                search_conditions.append(Message.content.ilike(f"%{word_escaped}%"))
        
        # 3. Поиск без учета регистра
        search_conditions.append(Message.content.ilike(f"%{query_lower_escaped}%"))
        
        # 4. Поиск по словам без учета регистра
        for word in words:
            if len(word) > 2:
                word_lower_escaped = self._escape_sql_like_pattern(word.lower())
                search_conditions.append(Message.content.ilike(f"%{word_lower_escaped}%"))
        
        return search_conditions
    
    def build_exact_message_search_conditions(self, query: str) -> List:
        """Создает условия поиска для СТРОГОГО поиска (только идеальное совпадение).
        
        Используется для поиска в конкретном чате.
        Требует, чтобы ВСЕ слова запроса присутствовали в сообщении.
        """
        from models.message import Message
        from sqlmodel import and_
        
        # Экранируем специальные символы SQL
        query_escaped = self._escape_sql_like_pattern(query)
        query_lower = query.lower().strip()
        query_lower_escaped = self._escape_sql_like_pattern(query_lower)
        words = [w.strip() for w in query.split() if w.strip()]
        
        if not words:
            return []
        
        # СТРОГИЙ ПОИСК: ВСЕ слова должны присутствовать в сообщении
        # Используем AND логику, а не OR
        
        # Вариант 1: Точное совпадение всей фразы (с учетом регистра)
        exact_phrase_conditions = [
            Message.content.ilike(f"{query_escaped}%"),
            Message.content.ilike(f"%{query_escaped}%"),
            Message.content.ilike(f"%{query_escaped}")
        ]
        
        # Вариант 2: Точное совпадение всей фразы (без учета регистра)
        exact_phrase_lower_conditions = [
            Message.content.ilike(f"{query_lower_escaped}%"),
            Message.content.ilike(f"%{query_lower_escaped}%"),
            Message.content.ilike(f"%{query_lower_escaped}")
        ]
        
        # Вариант 3: ВСЕ слова запроса должны присутствовать (AND логика)
        # Фильтруем очень короткие слова (1-2 символа) - предлоги, союзы
        significant_words = [w for w in words if len(w) > 2]
        if not significant_words:
            # Если все слова короткие, используем оригинальные
            significant_words = words
        
        # Создаем условие: каждое значимое слово должно быть в тексте
        all_words_conditions = []
        for word in significant_words:
            word_escaped = self._escape_sql_like_pattern(word)
            word_lower = word.lower()
            word_lower_escaped = self._escape_sql_like_pattern(word_lower)
            # Ищем слово как отдельное (с пробелами вокруг или в начале/конце строки)
            word_conditions = [
                Message.content.ilike(f"% {word_escaped} %"),  # Слово в середине
                Message.content.ilike(f"{word_escaped} %"),     # Слово в начале
                Message.content.ilike(f"% {word_escaped}"),     # Слово в конце
                Message.content.ilike(f"{word_escaped}"),       # Только слово
                Message.content.ilike(f"% {word_lower_escaped} %"),  # Без учета регистра
                Message.content.ilike(f"{word_lower_escaped} %"),
                Message.content.ilike(f"% {word_lower_escaped}"),
                Message.content.ilike(f"{word_lower_escaped}")
            ]
            all_words_conditions.append(or_(*word_conditions))
        
        # Объединяем все варианты через OR
        # Но внутри варианта 3 используем AND - все слова должны быть
        search_conditions = []
        
        # Добавляем точные совпадения фразы
        search_conditions.extend(exact_phrase_conditions)
        search_conditions.extend(exact_phrase_lower_conditions)
        
        # Добавляем условие, что ВСЕ слова присутствуют (AND логика)
        if all_words_conditions:
            search_conditions.append(and_(*all_words_conditions))
        
        return search_conditions
    
    def get_agent_info_for_regular_chat(self, conversation: Conversation, agent, session: Session) -> Dict[str, Any]:
        """Получить информацию об агенте для обычного чата"""
        is_system_chat = getattr(conversation, 'is_system_chat', False)
        
        if getattr(conversation, "is_channel", False):
            channel_title = conversation.title or "Канал"
            avatar_url = None
            color_class = getattr(conversation, "color_class", None)
            icon_name = "notifications"

            if agent:
                avatar_url = agent.image_url or agent.avatar_url
                color_class = agent.color_class or color_class
                if agent.icon_name:
                    icon_name = agent.icon_name

            if not avatar_url:
                avatar_url = DEFAULT_CHANNEL_AVATAR

            return {
                "agent_avatar": avatar_url,
                "agent_name": channel_title,
                "agent_color": color_class or "bg-blue-500",
                "agent_icon": icon_name,
                "group_avatar": None,
            }
        elif agent:
            return {
                "agent_avatar": agent.image_url or agent.avatar_url,
                "agent_name": agent.name,
                "agent_color": agent.color_class or "bg-blue-500",
                "agent_icon": agent.icon_name or "psychology",
                "group_avatar": None,
            }
        else:
            # Агент не найден - пытаемся извлечь имя из заголовка разговора
            agent_name = "Неизвестный агент"
            if conversation and conversation.title:
                # Убираем префиксы "Чат с ", "Chat with " из заголовка
                title = conversation.title
                prefixes = ["Чат с ", "Тестовый чат с ", "Текстовый чат с ", "Chat with ", "Test chat with ", "Text chat with "]
                for prefix in prefixes:
                    if title.startswith(prefix):
                        agent_name = title[len(prefix):]
                        break
                else:
                    # Если префикса нет, используем заголовок как есть
                    if title:
                        agent_name = title
            
            return {
                "agent_avatar": None,
                "agent_name": agent_name,
                "agent_color": "bg-blue-500",
                "agent_icon": "psychology",
                "group_avatar": None,
            }
    
    def get_agent_info_for_group_chat(self, multi_conversation, session: Session) -> Dict[str, Any]:
        """Получить информацию об агенте для группового чата"""
        from models.multi_agent_conversation import ConversationAgent
        from models.agent import Agent
        
        conversation_agents = session.exec(
            select(ConversationAgent, Agent)
            .join(Agent, ConversationAgent.agent_id == Agent.id)
            .where(
                ConversationAgent.conversation_id == multi_conversation.id,
                ConversationAgent.is_active == True
            )
        ).all()
        
        if conversation_agents:
            first_agent = conversation_agents[0][1]
            if multi_conversation.title:
                agent_name = multi_conversation.title
            else:
                agent_names = [ca[1].name for ca in conversation_agents[:3]]
                agent_name = ", ".join(agent_names)
                if len(conversation_agents) > 3:
                    agent_name += f" +{len(conversation_agents) - 3}"
            
            return {
                "agent_avatar": None,
                "agent_name": agent_name,
                "agent_color": first_agent.color_class or "bg-purple-500",
                "agent_icon": multi_conversation.group_avatar or "group",
                "group_avatar": multi_conversation.group_avatar or "group",
                "group_avatar_url": multi_conversation.group_avatar_url,
            }
        else:
            return {
                "agent_avatar": None,
                "agent_name": multi_conversation.title or "Групповой чат",
                "agent_color": "bg-purple-500",
                "agent_icon": multi_conversation.group_avatar or "group",
                "group_avatar": multi_conversation.group_avatar or "group",
                "group_avatar_url": multi_conversation.group_avatar_url,
            }
    
    def _sanitize_message_content(self, content: Optional[str]) -> str:
        """Удаляет HTML разметку из текста сообщения для безопасного отображения."""
        if not content:
            return ""
        
        text = unescape(content)
        
        # Замена часто встречающихся переносов строк
        text = re.sub(r'<\s*br\s*/?>', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'</?\s*p\s*>', '\n', text, flags=re.IGNORECASE)
        
        # Удаляем HTML теги, оставляя текст
        text = re.sub(r'<[^>]+>', '', text)
        
        # Приводим пробелы к компактному виду
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def format_message_result(
        self,
        message,
        conversation,
        agent_info: Dict[str, Any],
        query: str,
        is_group: bool = False,
        multi_conversation=None
    ) -> Dict[str, Any]:
        """Форматирует результат поиска сообщения"""
        sanitized_content = self._sanitize_message_content(message.content)
        relevance = self.calculate_relevance_score(sanitized_content, query)
        
        is_channel = bool(getattr(conversation, "is_channel", False)) if conversation else False

        result = {
            "id": message.id,
            "content": sanitized_content,
            "created_at": message.created_at,
            "is_from_user": message.is_from_user,
            "conversation_id": conversation.id if conversation else multi_conversation.id,
            "conversation_title": conversation.title if conversation else (multi_conversation.title or agent_info["agent_name"]),
            "agent_id": None if is_channel else (conversation.agent_id if conversation else None),
            "agent_name": agent_info["agent_name"],
            "agent_avatar": agent_info["agent_avatar"],
            "agent_color": agent_info["agent_color"],
            "agent_icon": agent_info["agent_icon"],
            "is_group": is_group,
            "is_channel": is_channel,
            "relevance_score": relevance,
            "type": "message",
            "group_avatar": agent_info.get("group_avatar") if is_group else None,
            "group_avatar_url": agent_info.get("group_avatar_url") if is_group else None,
        }

        if is_channel and conversation:
            result["channel_description"] = conversation.channel_description
        
        if is_group and multi_conversation:
            result["multi_agent_conversation_id"] = multi_conversation.id
        
        return result
    
    def _get_user_channel_ids(self, session: Session, user_id: int) -> Set[int]:
        """Получить ID каналов, на которые подписан пользователь."""
        from models.user_channel_subscription import UserChannelSubscription
        
        channel_ids = session.exec(
            select(UserChannelSubscription.channel_id).where(
                UserChannelSubscription.user_id == user_id
            )
        ).all()
        
        return {channel_id for channel_id in channel_ids if channel_id is not None}
    
    def _user_has_access_to_conversation(
        self,
        conversation: Optional[Conversation],
        user_id: int,
        subscribed_channel_ids: Optional[Set[int]] = None
    ) -> bool:
        """Проверка, имеет ли пользователь доступ к конкретному чату/каналу."""
        if not conversation:
            return False
        
        if conversation.user_id == user_id:
            return True
        
        if conversation.channel_owner_id == user_id:
            return True
        
        if getattr(conversation, "is_channel", False):
            if getattr(conversation, "is_system_chat", False):
                return True
            if getattr(conversation, "is_listed", False):
                return True
            if subscribed_channel_ids and conversation.id in subscribed_channel_ids:
                return True
        
        return False
    
    def _build_accessible_conversation_condition(
        self,
        user_id: int,
        subscribed_channel_ids: Optional[Set[int]] = None
    ):
        """Сформировать условие выборки чатов, доступных пользователю."""
        access_conditions = [
            Conversation.user_id == user_id,
            Conversation.channel_owner_id == user_id,
        ]
        
        access_conditions.append(
            and_(
                Conversation.is_channel == True,  # noqa: E712
                Conversation.is_listed == True  # noqa: E712
            )
        )

        if subscribed_channel_ids:
            access_conditions.append(Conversation.id.in_(list(subscribed_channel_ids)))
        
        return or_(*access_conditions)
    
    def search_conversations(
        self,
        query: str,
        user_id: int,
        session: Session,
        limit: int = 20,
        sort_by: str = "relevance"
    ) -> Dict[str, Any]:
        """Поиск по чатам пользователя"""
        # Экранируем специальные символы SQL
        query_escaped = self._escape_sql_like_pattern(query)
        
        # Создаем более гибкий поисковый запрос
        search_conditions = [
            Conversation.title.ilike(f"{query_escaped}%"),
            Conversation.title.ilike(f"%{query_escaped}%")
        ]
        
        # Поиск по словам
        words = query.split()
        for word in words:
            if len(word) > 2:
                word_escaped = self._escape_sql_like_pattern(word)
                search_conditions.append(Conversation.title.ilike(f"%{word_escaped}%"))
        
        statement = (
            select(Conversation)
            .where(
                Conversation.user_id == user_id,
                or_(*search_conditions),
                # Исключаем системные чаты (Saved Messages) из результатов поиска
                Conversation.is_system_chat == False
            )
        )
        
        # Применяем сортировку
        if sort_by == "date":
            statement = statement.order_by(Conversation.updated_at.desc())
        elif sort_by == "title":
            statement = statement.order_by(Conversation.title.asc())
        else:  # relevance
            statement = statement.order_by(Conversation.updated_at.desc())
        
        statement = statement.limit(limit * 2)
        conversations = session.exec(statement).all()
        
        # Улучшаем результаты с релевантностью
        enhanced_results = self.enhance_search_results(conversations, query, "conversation")
        
        # Фильтруем по релевантности и ограничиваем
        filtered_results = [r for r in enhanced_results if r["relevance_score"] > 0]
        final_results = filtered_results[:limit]
        
        return {
            "query": query,
            "results": final_results,
            "total": len(final_results),
            "sort_by": sort_by,
            "has_more": len(filtered_results) > limit
        }
    
    def search_messages_in_conversation(
        self,
        conversation_id: int,
        query: str,
        user_id: int,
        session: Session,
        limit: int = 75,
        filter_type: str = "all",
        sort_by: str = "relevance"
    ) -> Dict[str, Any]:
        """Поиск по сообщениям в конкретном чате"""
        from models.message import Message
        from models.agent import Agent
        from models.multi_agent_conversation import MultiAgentConversation
        
        # Пытаемся найти обычный чат
        conversation = session.get(Conversation, conversation_id)
        subscribed_channel_ids = self._get_user_channel_ids(session, user_id)
        is_group_chat = False
        multi_conversation = None
        
        if conversation:
            if self._user_has_access_to_conversation(conversation, user_id, subscribed_channel_ids):
                is_group_chat = False
            else:
                return None
        else:
            # Пытаемся найти групповой чат
            multi_conversation = session.get(MultiAgentConversation, conversation_id)
            if multi_conversation and multi_conversation.user_id == user_id:
                is_group_chat = True
            else:
                return None  # Не найдено
        
        # КРИТИЧНО: Для поиска в конкретном чате используем СТРОГИЙ поиск
        # Только идеальное совпадение - точная фраза или ВСЕ слова запроса
        search_conditions = self.build_exact_message_search_conditions(query)
        
        if not search_conditions:
            # Если запрос пустой или некорректный, возвращаем пустой результат
            return {
                "query": query,
                "conversation_id": conversation_id,
                "filter_type": filter_type,
                "results": [],
                "total": 0,
                "sort_by": sort_by,
                "has_more": False
            }
        
        # Базовый запрос в зависимости от типа чата
        if is_group_chat:
            statement = (
                select(Message)
                .where(
                    Message.multi_agent_conversation_id == conversation_id,
                    or_(*search_conditions),
                    Message.is_deleted == False
                )
            )
        else:
            statement = (
                select(Message)
                .where(
                    Message.conversation_id == conversation_id,
                    or_(*search_conditions),
                    Message.is_deleted == False
                )
            )
        
        # Применяем фильтр
        if filter_type == "pinned" and not is_group_chat:
            pinned_messages = getattr(conversation, 'get_pinned_messages', lambda: [])()
            if pinned_messages:
                statement = statement.where(Message.id.in_(pinned_messages))
            else:
                return {
                    "query": query,
                    "conversation_id": conversation_id,
                    "filter_type": filter_type,
                    "results": [],
                    "total": 0,
                    "sort_by": sort_by
                }
        
        # Применяем сортировку
        if sort_by == "date":
            statement = statement.order_by(Message.created_at.desc())
        else:  # relevance
            statement = statement.order_by(Message.created_at.desc())
        
        messages = session.exec(statement).all()
        
        # Формируем результаты с информацией о чате и агенте
        enhanced_results = []
        
        if is_group_chat:
            agent_info = self.get_agent_info_for_group_chat(multi_conversation, session)
            for message in messages:
                result = self.format_message_result(
                    message, None, agent_info, query,
                    is_group=True, multi_conversation=multi_conversation
                )
                enhanced_results.append(result)
        else:
            agent = session.get(Agent, conversation.agent_id) if conversation.agent_id else None
            agent_info = self.get_agent_info_for_regular_chat(conversation, agent, session)
            for message in messages:
                result = self.format_message_result(
                    message, conversation, agent_info, query, is_group=False
                )
                enhanced_results.append(result)
        
        # ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА для строгого поиска в одном чате
        # Убеждаемся, что все слова запроса действительно присутствуют в сообщении
        query_words = [w.strip().lower() for w in query.split() if w.strip() and len(w.strip()) > 2]
        if not query_words:
            # Если все слова короткие, проверяем точное совпадение фразы
            query_words = [query.lower().strip()]
        
        def matches_exact_search(content: str) -> bool:
            """Проверяет, что сообщение соответствует строгому поиску"""
            if not content:
                return False
            content_lower = content.lower()
            query_lower = query.lower().strip()
            
            # Проверка 1: Точное совпадение фразы
            if query_lower in content_lower:
                return True
            
            # Проверка 2: Все значимые слова присутствуют
            if query_words:
                for word in query_words:
                    # Ищем слово как отдельное (с границами слов)
                    word_pattern = r'\b' + re.escape(word) + r'\b'
                    if not re.search(word_pattern, content_lower, re.IGNORECASE):
                        return False
                return True
            
            return False
        
        # Фильтруем результаты по строгому соответствию
        # Используем оригинальный контент сообщений (до санитизации) для проверки
        strictly_filtered = []
        for result in enhanced_results:
            # Получаем оригинальный контент из сообщения
            message_id = result.get("id")
            if message_id:
                # Находим оригинальное сообщение в базе для проверки
                original_message = session.get(Message, message_id)
                if original_message:
                    # Санитизируем оригинальный контент для проверки
                    sanitized_original = self._sanitize_message_content(original_message.content)
                    if matches_exact_search(sanitized_original):
                        strictly_filtered.append(result)
                else:
                    # Если сообщение не найдено, используем санитизированный контент из результата
                    content = result.get("content", "")
                    if matches_exact_search(content):
                        strictly_filtered.append(result)
            else:
                # Если нет ID, используем контент из результата
                content = result.get("content", "")
                if matches_exact_search(content):
                    strictly_filtered.append(result)
        
        # Сортируем по релевантности или дате
        if sort_by == "date":
            strictly_filtered.sort(key=lambda x: x["created_at"], reverse=True)
        else:  # relevance
            strictly_filtered.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        # Ограничиваем результаты
        final_results = strictly_filtered[:limit]
        
        return {
            "query": query,
            "conversation_id": conversation_id,
            "filter_type": filter_type,
            "results": final_results,
            "total": len(final_results),
            "sort_by": sort_by,
            "has_more": len(strictly_filtered) > limit
        }
    
    def search_messages(
        self,
        query: str,
        user_id: int,
        session: Session,
        limit: int = 75,
        sort_by: str = "relevance"
    ) -> Dict[str, Any]:
        """Поиск сообщений по всем чатам пользователя"""
        logger.info(f"Starting search_messages for user_id={user_id}, query='{query}', limit={limit}")
        
        from models.message import Message
        from models.agent import Agent
        from models.multi_agent_conversation import MultiAgentConversation, ConversationAgent
        
        try:
            # Создаем условия поиска
            logger.info("Building search conditions...")
            search_conditions = self.build_message_search_conditions(query)
            logger.info(f"Built {len(search_conditions)} search conditions")
            
            subscribed_channel_ids = self._get_user_channel_ids(session, user_id)
            logger.info(f"User {user_id} is subscribed to {len(subscribed_channel_ids)} channels")
            
            accessible_conversations_condition = self._build_accessible_conversation_condition(
                user_id, subscribed_channel_ids
            )
            logger.info("Built accessible conversations condition")
            
            # ПОИСК В ОБЫЧНЫХ ЧАТАХ
            logger.info("Searching in regular conversations...")
            regular_messages_statement = (
                select(Message, Conversation, Agent)
                .join(Conversation, Message.conversation_id == Conversation.id)
                .outerjoin(Agent, Conversation.agent_id == Agent.id)
                .where(
                    accessible_conversations_condition,
                    or_(*search_conditions),
                    Message.is_deleted == False,
                    # Исключаем системные чаты (Saved Messages) из результатов поиска
                    Conversation.is_system_chat == False
                )
            )
            
            regular_results = session.exec(regular_messages_statement).all()
            logger.info(f"Found {len(regular_results)} results in regular conversations")
            
            # ПОИСК В ГРУППОВЫХ ЧАТАХ
            logger.info("Searching in group conversations...")
            group_messages_statement = (
                select(Message, MultiAgentConversation)
                .join(MultiAgentConversation, Message.multi_agent_conversation_id == MultiAgentConversation.id)
                .where(
                    MultiAgentConversation.user_id == user_id,
                    or_(*search_conditions),
                    Message.is_deleted == False
                )
            )
            
            group_results = session.exec(group_messages_statement).all()
            logger.info(f"Found {len(group_results)} results in group conversations")
            
            # Формируем результаты с информацией о чате и агенте
            enhanced_results = []
            
            # ОБРАБОТКА ОБЫЧНЫХ ЧАТОВ
            logger.info("Processing regular conversation results...")
            for message, conversation, agent in regular_results:
                # Пропускаем сообщения из разговоров с удаленными агентами
                if conversation and conversation.agent_id and not agent:
                    logger.debug(f"Пропускаем сообщение {message.id}: агент {conversation.agent_id} не существует")
                    continue
                agent_info = self.get_agent_info_for_regular_chat(conversation, agent, session)
                result = self.format_message_result(message, conversation, agent_info, query, is_group=False)
                enhanced_results.append(result)
            
            # ОБРАБОТКА ГРУППОВЫХ ЧАТОВ
            logger.info("Processing group conversation results...")
            for message, multi_conversation in group_results:
                agent_info = self.get_agent_info_for_group_chat(multi_conversation, session)
                result = self.format_message_result(
                    message, None, agent_info, query,
                    is_group=True, multi_conversation=multi_conversation
                )
                enhanced_results.append(result)
            
            logger.info(f"Total enhanced results: {len(enhanced_results)}")
            
            # Сортируем по релевантности или дате
            if sort_by == "date":
                enhanced_results.sort(key=lambda x: x["created_at"], reverse=True)
            else:  # relevance
                enhanced_results.sort(key=lambda x: x["relevance_score"], reverse=True)
            
            # Фильтруем и ограничиваем
            filtered_results = [r for r in enhanced_results if r["relevance_score"] > 0]
            logger.info(f"Filtered results with relevance > 0: {len(filtered_results)}")
            
            final_results = filtered_results[:limit]
            logger.info(f"Final results after limiting to {limit}: {len(final_results)}")
            
            return {
                "query": query,
                "results": final_results,
                "total": len(final_results),
                "sort_by": sort_by,
                "has_more": len(filtered_results) > limit
            }
        except Exception as e:
            logger.error(f"Error in search_messages for user {user_id}: {e}", exc_info=True)
            raise
    
    def global_search(
        self,
        query: str,
        user_id: int,
        session: Session,
        limit: int = 30,
        sort_by: str = "relevance"
    ) -> Dict[str, Any]:
        """Глобальный поиск по всем чатам и сообщениям пользователя"""
        from models.message import Message
        
        # Экранируем специальные символы SQL
        query_escaped = self._escape_sql_like_pattern(query)
        
        subscribed_channel_ids = self._get_user_channel_ids(session, user_id)
        accessible_conversations_condition = self._build_accessible_conversation_condition(
            user_id, subscribed_channel_ids
        )
        
        # Поиск по чатам
        conversations_statement = (
            select(Conversation)
            .where(
                accessible_conversations_condition,
                or_(
                    Conversation.title.ilike(f"{query_escaped}%"),
                    Conversation.title.ilike(f"%{query_escaped}%")
                ),
                # Исключаем системные чаты (Saved Messages) из результатов поиска
                Conversation.is_system_chat == False
            )
            .order_by(Conversation.updated_at.desc())
            .limit(limit // 2)
        )
        
        conversations = session.exec(conversations_statement).all()
        
        # Поиск по сообщениям
        messages_statement = (
            select(Message)
            .join(Conversation)
            .where(
                accessible_conversations_condition,
                or_(
                    Message.content.ilike(f"{query_escaped}%"),
                    Message.content.ilike(f"%{query_escaped}%")
                ),
                Message.is_deleted == False,
                # Исключаем системные чаты (Saved Messages) из результатов поиска
                Conversation.is_system_chat == False
            )
            .order_by(Message.created_at.desc())
            .limit(limit // 2)
        )
        
        messages = session.exec(messages_statement).all()
        
        # Добавляем информацию о чате к сообщениям и фильтруем сообщения от удаленных агентов
        filtered_messages = []
        for message in messages:
            conversation = session.get(Conversation, message.conversation_id)
            if conversation:
                # Пропускаем сообщения из разговоров с удаленными агентами
                if conversation.agent_id:
                    agent = session.get(Agent, conversation.agent_id)
                    if not agent:
                        logger.debug(f"Пропускаем сообщение {message.id}: агент {conversation.agent_id} не существует")
                        continue
                message.conversation_title = conversation.title
                filtered_messages.append(message)
            else:
                message.conversation_title = "Неизвестный чат"
                filtered_messages.append(message)
        messages = filtered_messages
        
        # Улучшаем результаты с релевантностью
        enhanced_conversations = self.enhance_search_results(conversations, query, "conversation")
        enhanced_messages = self.enhance_search_results(messages, query, "message")
        
        # Объединяем и сортируем результаты
        all_results = enhanced_conversations + enhanced_messages
        
        if sort_by == "date":
            all_results.sort(key=lambda x: x.get("updated_at") or x.get("created_at"), reverse=True)
        else:  # relevance
            all_results.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        # Фильтруем по релевантности
        filtered_results = [r for r in all_results if r["relevance_score"] > 0]
        final_results = filtered_results[:limit]
        
        return {
            "query": query,
            "results": final_results,
            "total": len(final_results),
            "conversations_count": len([r for r in final_results if r["type"] == "conversation"]),
            "messages_count": len([r for r in final_results if r["type"] == "message"]),
            "sort_by": sort_by,
            "has_more": len(filtered_results) > limit
        }

