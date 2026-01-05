from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import logging
from collections import defaultdict
import random

logger = logging.getLogger(__name__)


class CoordinationStrategy(str, Enum):
    """Стратегии координации агентов"""
    SEQUENTIAL = "sequential"  # Последовательные ответы
    PARALLEL = "parallel"  # Параллельные ответы
    COLLABORATIVE = "collaborative"  # Сотрудничество
    DEBATE = "debate"  # Дебаты
    BRAINSTORM = "brainstorm"  # Мозговой штурм
    QNA = "qna"  # Вопрос-ответ сессия


class AgentCoordinationService:
    """Сервис для координации взаимодействий между агентами"""
    
    def __init__(self):
        # Текущие стратегии для разговоров
        self.conversation_strategies: Dict[int, CoordinationStrategy] = {}
        
        # Очередь агентов для ответов
        self.agent_queues: Dict[int, List[int]] = defaultdict(list)
        
        # Приоритеты агентов в разговорах
        self.agent_priorities: Dict[int, Dict[int, float]] = defaultdict(dict)
    
    def determine_strategy(
        self,
        conversation_id: int,
        user_message: str,
        agents: List[Dict[str, Any]],
        conversation_context: List[Dict[str, Any]]
    ) -> CoordinationStrategy:
        """Определить стратегию координации для разговора"""
        
        # Анализируем сообщение пользователя
        message_lower = user_message.lower()
        
        # Признаки разных стратегий
        if any(word in message_lower for word in ["обсудим", "обсуждение", "мнения", "discuss", "opinions"]):
            strategy = CoordinationStrategy.DEBATE
        elif any(word in message_lower for word in ["идеи", "предложения", "варианты", "ideas", "suggestions"]):
            strategy = CoordinationStrategy.BRAINSTORM
        elif "?" in user_message:
            strategy = CoordinationStrategy.QNA
        elif len(conversation_context) > 5:
            # Если уже идет активный диалог
            strategy = CoordinationStrategy.COLLABORATIVE
        else:
            strategy = CoordinationStrategy.SEQUENTIAL
        
        self.conversation_strategies[conversation_id] = strategy
        logger.debug(f"Determined strategy {strategy.value} for conversation {conversation_id}")
        
        return strategy
    
    def get_strategy(self, conversation_id: int) -> CoordinationStrategy:
        """Получить текущую стратегию для разговора"""
        return self.conversation_strategies.get(
            conversation_id, CoordinationStrategy.SEQUENTIAL
        )
    
    def build_coordination_instructions(
        self,
        strategy: CoordinationStrategy,
        agent: Dict[str, Any],
        other_agents: List[Dict[str, Any]],
        conversation_context: List[Dict[str, Any]]
    ) -> str:
        """Построить инструкции координации для агента"""
        
        agent_name = agent.get("name", "Агент")
        other_names = [a.get("name", "Агент") for a in other_agents]
        
        base_instruction = f"{agent_name}, ты участвуешь в групповом обсуждении. "
        base_instruction += f"Другие участники: {', '.join(other_names)}.\n\n"
        
        strategy_instructions = {
            CoordinationStrategy.SEQUENTIAL: (
                "Отвечай последовательно, учитывая предыдущие ответы. "
                "Не повторяй то, что уже сказали другие. Добавь свою уникальную перспективу."
            ),
            CoordinationStrategy.COLLABORATIVE: (
                "Работай в команде с другими участниками. "
                "Развивай их идеи, дополняй их мысли, создавай синергию. "
                "Будь конструктивным и поддерживающим."
            ),
            CoordinationStrategy.DEBATE: (
                "Участвуй в конструктивной дискуссии. "
                "Выражай свое мнение, приводи аргументы, но будь уважительным. "
                "Можешь соглашаться или не соглашаться с другими, но обосновывай свою позицию."
            ),
            CoordinationStrategy.BRAINSTORM: (
                "Генерируй идеи и предложения. "
                "Не критикуй идеи других на этом этапе - просто добавляй свои. "
                "Будь креативным и открытым к новым возможностям."
            ),
            CoordinationStrategy.QNA: (
                "Отвечай на вопросы подробно и точно. "
                "Если другие уже ответили, можешь дополнить или уточнить их ответы. "
                "Если вопрос адресован тебе напрямую, ответь первым."
            ),
            CoordinationStrategy.PARALLEL: (
                "Ты можешь отвечать параллельно с другими. "
                "Не жди их ответов - выражай свое мнение независимо, "
                "но учитывай общий контекст разговора."
            ),
        }
        
        strategy_instruction = strategy_instructions.get(
            strategy, strategy_instructions[CoordinationStrategy.SEQUENTIAL]
        )
        
        # Добавляем контекст предыдущих сообщений
        if conversation_context:
            recent_messages = conversation_context[-3:]
            context_text = "Последние сообщения:\n"
            for msg in recent_messages:
                sender = msg.get("agent_name", "Агент") if not msg.get("is_from_user") else "Пользователь"
                content = msg.get("content", "") or msg.get("message", "")
                context_text += f"- {sender}: {content[:100]}...\n"
            
            base_instruction += context_text + "\n"
        
        return base_instruction + strategy_instruction
    
    def calculate_agent_priority(
        self,
        agent: Dict[str, Any],
        conversation_id: int,
        user_message: str,
        conversation_context: List[Dict[str, Any]],
        strategy: CoordinationStrategy
    ) -> float:
        """Рассчитать приоритет агента для ответа"""
        
        agent_id = agent.get("id")
        base_priority = 0.5
        
        # Приоритет на основе категории агента
        category = agent.get("category", "").lower()
        message_lower = user_message.lower()
        
        category_relevance = {
            "technical": ["код", "программирование", "технология", "алгоритм"],
            "business": ["бизнес", "стратегия", "маркетинг", "продажи"],
            "creative": ["идея", "творчество", "дизайн", "художественный"],
            "science": ["наука", "исследование", "эксперимент", "теория"],
        }
        
        if category in category_relevance:
            keywords = category_relevance[category]
            matches = sum(1 for keyword in keywords if keyword in message_lower)
            if matches > 0:
                base_priority += matches * 0.15
        
        # Приоритет на основе участия в разговоре
        agent_participation = sum(
            1 for msg in conversation_context
            if msg.get("agent_id") == agent_id
        )
        
        # Если агент еще не говорил, увеличиваем приоритет
        if agent_participation == 0:
            base_priority += 0.2
        elif agent_participation >= 3:
            # Если уже много говорил, снижаем приоритет
            base_priority -= 0.2
        
        # Приоритет на основе стратегии
        strategy_priorities = {
            CoordinationStrategy.DEBATE: 0.1,  # В дебатах все равны
            CoordinationStrategy.BRAINSTORM: 0.15,  # В мозговом штурме все важны
            CoordinationStrategy.QNA: 0.2,  # В Q&A эксперт важнее
            CoordinationStrategy.COLLABORATIVE: 0.1,
            CoordinationStrategy.SEQUENTIAL: 0.0,
        }
        
        base_priority += strategy_priorities.get(strategy, 0.0)
        
        # Ограничиваем диапазон
        base_priority = max(0.0, min(1.0, base_priority))
        
        # Сохраняем приоритет
        self.agent_priorities[conversation_id][agent_id] = base_priority
        
        return base_priority
    
    def get_agent_queue(
        self,
        conversation_id: int,
        agents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Получить очередь агентов для ответов, отсортированную по приоритету"""
        
        # Получаем приоритеты
        priorities = self.agent_priorities.get(conversation_id, {})
        
        # Сортируем агентов по приоритету
        agents_with_priority = [
            (agent, priorities.get(agent.get("id"), 0.5))
            for agent in agents
        ]
        
        agents_with_priority.sort(key=lambda x: x[1], reverse=True)
        
        return [agent for agent, _ in agents_with_priority]
    
    def should_agent_wait(
        self,
        agent_id: int,
        conversation_id: int,
        strategy: CoordinationStrategy,
        current_responses: List[Dict[str, Any]]
    ) -> bool:
        """Определить, должен ли агент ждать перед ответом"""
        
        if strategy == CoordinationStrategy.PARALLEL:
            return False  # В параллельной стратегии не ждем
        
        if strategy == CoordinationStrategy.SEQUENTIAL:
            # В последовательной стратегии ждем, если уже есть ответы
            return len(current_responses) > 0
        
        if strategy == CoordinationStrategy.QNA:
            # В Q&A ждем, если вопрос уже был задан
            return any("?" in r.get("message", "") for r in current_responses)
        
        # В остальных стратегиях не ждем
        return False
    
    def adjust_strategy(
        self,
        conversation_id: int,
        conversation_context: List[Dict[str, Any]],
        recent_responses: List[Dict[str, Any]]
    ) -> Optional[CoordinationStrategy]:
        """Адаптивно изменить стратегию на основе развития разговора"""
        
        current_strategy = self.get_strategy(conversation_id)
        
        # Анализируем последние ответы
        if not recent_responses:
            return None
        
        # Подсчитываем типы взаимодействий
        question_count = sum(1 for r in recent_responses if "?" in r.get("message", ""))
        agreement_count = sum(1 for r in recent_responses 
                            if any(word in r.get("message", "").lower() 
                                  for word in ["согласен", "поддерживаю", "agree"]))
        disagreement_count = sum(1 for r in recent_responses 
                                if any(word in r.get("message", "").lower() 
                                      for word in ["не согласен", "но", "однако", "disagree"]))
        
        # Если много вопросов, переключаемся на QNA
        if question_count >= 2 and current_strategy != CoordinationStrategy.QNA:
            new_strategy = CoordinationStrategy.QNA
            self.conversation_strategies[conversation_id] = new_strategy
            logger.debug(f"Switched to QNA strategy for conversation {conversation_id}")
            return new_strategy
        
        # Если много несогласий, переключаемся на дебаты
        if disagreement_count >= 2 and current_strategy != CoordinationStrategy.DEBATE:
            new_strategy = CoordinationStrategy.DEBATE
            self.conversation_strategies[conversation_id] = new_strategy
            logger.debug(f"Switched to DEBATE strategy for conversation {conversation_id}")
            return new_strategy
        
        # Если много согласий, переключаемся на сотрудничество
        if agreement_count >= 3 and current_strategy != CoordinationStrategy.COLLABORATIVE:
            new_strategy = CoordinationStrategy.COLLABORATIVE
            self.conversation_strategies[conversation_id] = new_strategy
            logger.debug(f"Switched to COLLABORATIVE strategy for conversation {conversation_id}")
            return new_strategy
        
        return None
    
    def reset_conversation(self, conversation_id: int):
        """Сбросить координацию для разговора"""
        if conversation_id in self.conversation_strategies:
            del self.conversation_strategies[conversation_id]
        if conversation_id in self.agent_queues:
            del self.agent_queues[conversation_id]
        if conversation_id in self.agent_priorities:
            del self.agent_priorities[conversation_id]


















