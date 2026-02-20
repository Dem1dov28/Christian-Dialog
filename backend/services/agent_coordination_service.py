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
        """Определить стратегию координации для разговора на основе семантического анализа."""

        message_lower = user_message.lower()

        # Взвешенное голосование по признакам стратегии
        scores: Dict[CoordinationStrategy, float] = defaultdict(float)

        # DEBATE — спор, дискуссия, столкновение мнений
        debate_signals = [
            "обсудим", "обсуждение", "мнения", "ваше мнение", "что думаете", "как считаете",
            "согласны ли", "спор", "дискуссия", "полемика", "argue", "debate", "discuss",
            "opinions", "do you agree", "what do you think", "мнение", "позиция",
            "точка зрения", "кто прав", "правда ли", "верно ли",
        ]
        for signal in debate_signals:
            if signal in message_lower:
                scores[CoordinationStrategy.DEBATE] += 1.0

        # BRAINSTORM — генерация идей, поиск решений
        brainstorm_signals = [
            "идеи", "предложения", "варианты", "как можно", "что если", "придумайте",
            "подумайте", "мозговой штурм", "brainstorm", "ideas", "suggestions", "solutions",
            "alternatives", "options", "ways to", "how to", "what are", "придумай",
            "придумайте", "посоветуйте", "посоветуй",
        ]
        for signal in brainstorm_signals:
            if signal in message_lower:
                scores[CoordinationStrategy.BRAINSTORM] += 1.0

        # QNA — вопрос ищет ответ
        if user_message.count("?") >= 1:
            scores[CoordinationStrategy.QNA] += 1.5
        # Вопросительные слова без знака (риторические и прямые)
        qna_signals = [
            "расскажи", "объясни", "почему", "зачем", "как это", "что такое",
            "кто такой", "расскажите", "объясните", "tell me", "explain", "what is",
            "who is", "why", "how does", "when did",
        ]
        for signal in qna_signals:
            if signal in message_lower:
                scores[CoordinationStrategy.QNA] += 0.5

        # COLLABORATIVE — совместная работа, уже идущий диалог
        if len(conversation_context) > 4:
            scores[CoordinationStrategy.COLLABORATIVE] += 0.8
        collab_signals = [
            "вместе", "совместно", "поработаем", "давайте", "let's", "together",
            "collaborate", "cooperate", "помогите", "помогите мне",
        ]
        for signal in collab_signals:
            if signal in message_lower:
                scores[CoordinationStrategy.COLLABORATIVE] += 0.7

        # Выбираем стратегию с наибольшим счётом
        if scores:
            strategy = max(scores, key=lambda k: scores[k])
            # Если счёт совсем мал (≤0.4) — нет чётких сигналов
            if scores[strategy] <= 0.4:
                strategy = CoordinationStrategy.SEQUENTIAL
        else:
            strategy = CoordinationStrategy.SEQUENTIAL

        self.conversation_strategies[conversation_id] = strategy
        logger.debug(
            f"Determined strategy {strategy.value} for conversation {conversation_id} "
            f"(scores: {dict(scores)})"
        )
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
        """Построить инструкции координации для агента.

        Инструкции намеренно сформулированы без жёстких ролевых предписаний,
        чтобы персонаж реагировал в своём голосе, а не как безликий «участник».
        """
        agent_name = agent.get("name", "Агент")
        other_names = [a.get("name", "Агент") for a in other_agents]
        participants_str = ", ".join(other_names) if other_names else "другие участники"

        # Контекст последних реплик (показываем не более 3)
        context_block = ""
        if conversation_context:
            recent = conversation_context[-3:]
            lines = []
            for msg in recent:
                sender = msg.get("agent_name", "Агент") if not msg.get("is_from_user") else "Пользователь"
                content = (msg.get("content") or msg.get("message") or "").strip()
                if content:
                    snippet = content[:120] + ("…" if len(content) > 120 else "")
                    lines.append(f"  {sender}: {snippet}")
            if lines:
                context_block = "Последние реплики в разговоре:\n" + "\n".join(lines) + "\n\n"

        # Наставление, специфичное для стратегии
        strategy_hints = {
            CoordinationStrategy.SEQUENTIAL: (
                f"Сейчас говорит {agent_name}. Вступай в разговор в своей неповторимой манере. "
                "Добавь свой угол зрения — то, что ещё не прозвучало."
            ),
            CoordinationStrategy.COLLABORATIVE: (
                f"{agent_name}, подхвати нить разговора. Развей или дополни то, что сказали "
                f"{participants_str}, опираясь на свой опыт и взгляды."
            ),
            CoordinationStrategy.DEBATE: (
                f"{agent_name}, выскажи свою позицию открыто. Соглашайся или возражай "
                f"{participants_str} — но делай это в собственном стиле, приводя конкретные доводы."
            ),
            CoordinationStrategy.BRAINSTORM: (
                f"{agent_name}, предложи идею, которая ещё не звучала. Будь смелым — "
                "на этапе поиска идей нет неправильных ответов."
            ),
            CoordinationStrategy.QNA: (
                f"{agent_name}, ответь на вопрос с позиции своего опыта и знаний. "
                "Если другие уже ответили — добавь нюанс или уточни."
            ),
            CoordinationStrategy.PARALLEL: (
                f"{agent_name}, выскажись независимо, опираясь на общий контекст разговора."
            ),
        }

        hint = strategy_hints.get(strategy, strategy_hints[CoordinationStrategy.SEQUENTIAL])

        return f"{context_block}{hint}"
    
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


















