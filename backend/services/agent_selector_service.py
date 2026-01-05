from typing import List, Dict, Any, Optional, Tuple
import random
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class AgentRole(str, Enum):
    """Роли агентов в групповом чате"""
    LEADER = "leader"  # Лидер обсуждения
    EXPERT = "expert"  # Эксперт по теме
    MODERATOR = "moderator"  # Модератор
    PARTICIPANT = "participant"  # Обычный участник
    OBSERVER = "observer"  # Наблюдатель (редко говорит)


class AgentSelectorService:
    """Улучшенный сервис для выбора агентов в диалогах с анализом релевантности"""
    
    def __init__(self):
        self.relevance_cache = {}  # Кэш для анализа релевантности
    
    def select_first_agent(
        self, 
        agents: List[Dict[str, Any]], 
        user_message: str,
        conversation_context: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Выбрать первого агента для ответа на основе релевантности
        
        Args:
            agents: Список агентов
            user_message: Сообщение пользователя
            conversation_context: Контекст предыдущих сообщений
            
        Returns:
            Выбранный агент с наивысшей релевантностью
        """
        if not agents:
            raise ValueError("Список агентов не может быть пустым")
        
        if len(agents) == 1:
            return agents[0]
        
        # Анализируем релевантность каждого агента
        agent_scores = []
        for agent in agents:
            score = self._calculate_relevance_score(
                agent, user_message, conversation_context
            )
            agent_scores.append((agent, score))
        
        # Сортируем по релевантности (от большего к меньшему)
        agent_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Выбираем из топ-3 с весами (70% - первый, 20% - второй, 10% - третий)
        top_agents = agent_scores[:3]
        if len(top_agents) == 1:
            return top_agents[0][0]
        
        # Взвешенный случайный выбор
        rand = random.random()
        if rand < 0.7:
            return top_agents[0][0]
        elif rand < 0.9 and len(top_agents) > 1:
            return top_agents[1][0]
        else:
            return top_agents[2][0] if len(top_agents) > 2 else top_agents[0][0]
    
    def select_responding_agents(
        self, 
        agents: List[Dict[str, Any]], 
        first_agent: Dict[str, Any],
        user_message: str,
        first_response: str,
        conversation_context: Optional[List[Dict[str, Any]]] = None,
        base_probability: float = 0.4
    ) -> List[Dict[str, Any]]:
        """Выбрать агентов, которые будут отвечать, с учетом релевантности
        
        Args:
            agents: Список всех агентов
            first_agent: Агент, который уже ответил первым
            user_message: Сообщение пользователя
            first_response: Ответ первого агента
            conversation_context: Контекст разговора
            base_probability: Базовая вероятность ответа (0.0 - 1.0)
            
        Returns:
            Список агентов, которые будут отвечать, отсортированный по приоритету
        """
        if not agents:
            return []
        
        self._validate_probability(base_probability)
        
        responding_agents = []
        agent_scores = []
        
        for agent in agents:
            # Пропускаем первого агента
            if agent["id"] == first_agent["id"]:
                continue
            
            # Рассчитываем релевантность для этого агента
            relevance_score = self._calculate_relevance_score(
                agent, 
                f"{user_message}\n{first_agent['name']}: {first_response}",
                conversation_context
            )
            
            # Адаптивная вероятность на основе релевантности
            # Чем выше релевантность, тем выше вероятность ответа
            adaptive_probability = base_probability + (relevance_score * 0.3)
            adaptive_probability = min(adaptive_probability, 0.95)  # Максимум 95%
            
            if random.random() < adaptive_probability:
                agent_scores.append((agent, relevance_score))
        
        # Сортируем по релевантности
        agent_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Ограничиваем количество отвечающих агентов (максимум 3)
        max_responding = min(3, len(agent_scores))
        responding_agents = [agent for agent, _ in agent_scores[:max_responding]]
        
        return responding_agents
    
    def select_next_agent_for_continuation(
        self, 
        agents: List[Dict[str, Any]], 
        last_agent_id: Optional[int] = None,
        conversation_context: Optional[List[Dict[str, Any]]] = None,
        recent_messages: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Выбрать следующего агента для продолжения диалога с умной логикой
        
        Args:
            agents: Список агентов
            last_agent_id: ID агента, который говорил последним
            conversation_context: Контекст разговора
            recent_messages: Последние сообщения для анализа
            
        Returns:
            Выбранный агент
        """
        if not agents:
            raise ValueError("Список агентов не может быть пустым")
        
        if len(agents) == 1:
            return agents[0]
        
        # Исключаем последнего говорящего
        available_agents = [
            agent for agent in agents 
            if agent["id"] != last_agent_id
        ]
        
        if not available_agents:
            available_agents = agents
        
        # Если есть контекст, анализируем релевантность
        if recent_messages and len(recent_messages) > 0:
            # Берем последние 3 сообщения для анализа
            context_text = "\n".join([
                f"{msg.get('agent_name', 'Агент')}: {msg.get('content', '')}"
                for msg in recent_messages[-3:]
            ])
            
            agent_scores = []
            for agent in available_agents:
                score = self._calculate_relevance_score(
                    agent, context_text, conversation_context
                )
                # Добавляем бонус за "молчание" (не говорил недавно)
                silence_bonus = self._calculate_silence_bonus(agent, recent_messages)
                total_score = score + silence_bonus
                agent_scores.append((agent, total_score))
            
            # Сортируем по общему score
            agent_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Выбираем из топ-2 с весами (80% - первый, 20% - второй)
            if len(agent_scores) >= 2:
                return agent_scores[0][0] if random.random() < 0.8 else agent_scores[1][0]
            else:
                return agent_scores[0][0]
        
        # Если нет контекста, используем случайный выбор с учетом активности
        return random.choice(available_agents)
    
    def select_agent_with_priority(
        self, 
        agents: List[Dict[str, Any]], 
        last_agent_id: Optional[int] = None, 
        second_last_agent_id: Optional[int] = None,
        conversation_context: Optional[List[Dict[str, Any]]] = None,
        recent_messages: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Выбрать агента с приоритетом, учитывая контекст и активность
        
        Args:
            agents: Список агентов
            last_agent_id: ID агента, который говорил последним
            second_last_agent_id: ID агента, который говорил предпоследним
            conversation_context: Контекст разговора
            recent_messages: Последние сообщения
            
        Returns:
            Выбранный агент
        """
        if not agents:
            raise ValueError("Список агентов не может быть пустым")
        
        # Исключаем последнего говорящего
        available_agents = [
            agent for agent in agents 
            if agent["id"] != last_agent_id
        ]
        
        # Если последние 2 сообщения от одного агента, исключаем его
        if last_agent_id == second_last_agent_id and second_last_agent_id is not None:
            available_agents = [
                agent for agent in available_agents 
                if agent["id"] != second_last_agent_id
            ]
        
        if not available_agents:
            available_agents = [
                agent for agent in agents 
                if agent["id"] != last_agent_id
            ]
        
        if not available_agents:
            available_agents = agents
        
        # Если есть контекст, используем умный выбор
        if recent_messages and len(recent_messages) > 0:
            return self.select_next_agent_for_continuation(
                available_agents, 
                last_agent_id, 
                conversation_context, 
                recent_messages
            )
        
        return random.choice(available_agents)
    
    def _calculate_relevance_score(
        self,
        agent: Dict[str, Any],
        message: str,
        conversation_context: Optional[List[Dict[str, Any]]] = None
    ) -> float:
        """Рассчитать релевантность агента для сообщения
        
        Args:
            agent: Данные агента
            message: Сообщение для анализа
            conversation_context: Контекст разговора
            
        Returns:
            Оценка релевантности от 0.0 до 1.0
        """
        score = 0.5  # Базовая релевантность
        
        # Анализ по категории агента
        agent_category = agent.get("category", "").lower()
        message_lower = message.lower()
        
        # Простой анализ ключевых слов по категориям
        category_keywords = {
            "technical": ["код", "программирование", "технология", "алгоритм", "функция", "api", "база данных"],
            "creative": ["идея", "творчество", "дизайн", "художественный", "креативный", "воображение"],
            "business": ["бизнес", "стратегия", "маркетинг", "продажи", "прибыль", "клиент"],
            "science": ["наука", "исследование", "эксперимент", "теория", "гипотеза", "анализ"],
            "education": ["обучение", "образование", "урок", "объяснить", "преподавать", "учить"],
            "health": ["здоровье", "медицина", "лечение", "симптом", "диагноз", "врач"],
        }
        
        if agent_category in category_keywords:
            keywords = category_keywords[agent_category]
            matches = sum(1 for keyword in keywords if keyword in message_lower)
            if matches > 0:
                score += min(matches * 0.15, 0.4)  # До +0.4 за совпадения
        
        # Анализ по имени агента (может содержать подсказки о специализации)
        agent_name = agent.get("name", "").lower()
        if any(word in message_lower for word in agent_name.split() if len(word) > 3):
            score += 0.2
        
        # Анализ по описанию агента
        agent_description = agent.get("description", "").lower()
        if agent_description:
            # Простой подсчет совпадений слов
            desc_words = set(agent_description.split())
            msg_words = set(message_lower.split())
            common_words = desc_words.intersection(msg_words)
            if common_words:
                score += min(len(common_words) * 0.05, 0.3)
        
        # Анализ по инструкциям агента (если доступны)
        agent_instructions = agent.get("instructions", "").lower()
        if agent_instructions:
            # Ищем ключевые слова из инструкций в сообщении
            instruction_keywords = [
                word for word in agent_instructions.split() 
                if len(word) > 4 and word in message_lower
            ]
            if instruction_keywords:
                score += min(len(instruction_keywords) * 0.03, 0.2)
        
        # Учет активности агента в контексте
        if conversation_context:
            # Подсчитываем, сколько раз агент упоминался или участвовал
            agent_participation = sum(
                1 for msg in conversation_context 
                if msg.get("agent_id") == agent.get("id")
            )
            # Небольшой бонус за участие, но не слишком большой
            if agent_participation > 0:
                score += min(agent_participation * 0.05, 0.15)
        
        return min(score, 1.0)  # Ограничиваем максимумом 1.0
    
    def _calculate_silence_bonus(
        self,
        agent: Dict[str, Any],
        recent_messages: List[Dict[str, Any]]
    ) -> float:
        """Рассчитать бонус за "молчание" (агент не говорил недавно)
        
        Args:
            agent: Данные агента
            recent_messages: Последние сообщения
            
        Returns:
            Бонус от 0.0 до 0.2
        """
        if not recent_messages:
            return 0.1  # Небольшой бонус, если нет истории
        
        # Проверяем последние 5 сообщений
        recent_count = min(5, len(recent_messages))
        agent_spoke_recently = any(
            msg.get("agent_id") == agent.get("id")
            for msg in recent_messages[:recent_count]
        )
        
        if not agent_spoke_recently:
            return 0.2  # Бонус за молчание
        else:
            return 0.0  # Нет бонуса, если недавно говорил
    
    def should_continue_dialogue(
        self, 
        agents: List[Dict[str, Any]],
        recent_responses: List[Dict[str, Any]],
        conversation_context: Optional[List[Dict[str, Any]]] = None,
        base_probability: float = 0.6
    ) -> bool:
        """Определить, стоит ли продолжать диалог на основе контекста
        
        Args:
            agents: Список агентов
            recent_responses: Последние ответы агентов
            conversation_context: Контекст разговора
            base_probability: Базовая вероятность продолжения
            
        Returns:
            True, если диалог следует продолжить
        """
        self._validate_probability(base_probability)
        
        # Если мало агентов, снижаем вероятность продолжения
        if len(agents) < 2:
            return False
        
        # Если уже много ответов в этом раунде, снижаем вероятность
        if len(recent_responses) >= 4:
            return random.random() < (base_probability * 0.5)
        
        # Если есть интересный контекст (вопросы, несогласие), увеличиваем вероятность
        if recent_responses:
            last_response = recent_responses[-1].get("message", "").lower()
            # Признаки активного диалога
            active_indicators = ["?", "но", "однако", "согласен", "не согласен", "дополню"]
            if any(indicator in last_response for indicator in active_indicators):
                return random.random() < min(base_probability + 0.2, 0.9)
        
        return random.random() < base_probability
    
    def should_add_final_response(self, probability: float = 0.3) -> bool:
        """Определить, стоит ли добавить финальный ответ
        
        Args:
            probability: Вероятность добавления финального ответа (0.0 - 1.0)
            
        Returns:
            True, если следует добавить финальный ответ
        """
        self._validate_probability(probability)
        return random.random() < probability
    
    @staticmethod
    def _validate_probability(probability: float) -> None:
        """Валидировать значение вероятности
        
        Args:
            probability: Вероятность (должна быть от 0.0 до 1.0)
            
        Raises:
            ValueError: Если вероятность вне допустимого диапазона
        """
        if not (0.0 <= probability <= 1.0):
            raise ValueError(f"Вероятность должна быть от 0.0 до 1.0, получено: {probability}")
