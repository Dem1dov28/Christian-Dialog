from typing import List, Dict, Any, Optional
from enum import Enum
import logging
from collections import defaultdict
from datetime import datetime, timedelta
import random

logger = logging.getLogger(__name__)

# Категория → предпочтительные роли для персонажей этой категории.
# Порядок важен: первая роль наиболее вероятна.
_CATEGORY_ROLE_PREFERENCES: Dict[str, List["AgentRole"]] = {}  # заполняется после определения AgentRole


class AgentRole(str, Enum):
    """Роли агентов в разговоре"""
    LEADER = "leader"        # Лидер обсуждения — задаёт направление
    EXPERT = "expert"        # Эксперт — даёт глубокие знания
    MODERATOR = "moderator"  # Модератор — поддерживает порядок
    CONTRIBUTOR = "contributor"  # Участник — вносит вклад
    QUESTIONER = "questioner"    # Вопрошающий — задаёт вопросы
    SUPPORTER = "supporter"      # Поддерживающий — соглашается и дополняет
    CRITIC = "critic"            # Критик — находит проблемы
    SYNTHESIZER = "synthesizer"  # Синтезатор — объединяет идеи
    OBSERVER = "observer"        # Наблюдатель — редко говорит, но внимательно слушает


# Категория персонажа → упорядоченный список предпочтительных ролей.
# Первая роль — наиболее типична для персонажей этой категории.
CATEGORY_ROLE_PREFERENCES: Dict[str, List[AgentRole]] = {
    # Военные / завоеватели — лидеры и эксперты в своём деле
    "military":    [AgentRole.LEADER, AgentRole.EXPERT, AgentRole.CONTRIBUTOR],
    "empire":      [AgentRole.LEADER, AgentRole.EXPERT, AgentRole.CONTRIBUTOR],

    # Политика и история — лидеры, критики, вкладчики
    "politics":    [AgentRole.LEADER, AgentRole.CRITIC, AgentRole.CONTRIBUTOR],
    "history":     [AgentRole.EXPERT, AgentRole.CONTRIBUTOR, AgentRole.SYNTHESIZER],
    "leadership":  [AgentRole.LEADER, AgentRole.EXPERT, AgentRole.CONTRIBUTOR],

    # Философия / религия / духовность — вопрошатели и синтезаторы
    "philosophy":  [AgentRole.QUESTIONER, AgentRole.SYNTHESIZER, AgentRole.CONTRIBUTOR],
    "religion":    [AgentRole.QUESTIONER, AgentRole.SYNTHESIZER, AgentRole.SUPPORTER],
    "spirituality":[AgentRole.QUESTIONER, AgentRole.SUPPORTER, AgentRole.SYNTHESIZER],

    # Наука — эксперты и вопрошатели
    "science":     [AgentRole.EXPERT, AgentRole.QUESTIONER, AgentRole.CONTRIBUTOR],
    "physics":     [AgentRole.EXPERT, AgentRole.QUESTIONER, AgentRole.CONTRIBUTOR],
    "biology":     [AgentRole.EXPERT, AgentRole.QUESTIONER, AgentRole.CONTRIBUTOR],
    "math":        [AgentRole.EXPERT, AgentRole.CRITIC, AgentRole.CONTRIBUTOR],

    # Психология — аналитики и вопрошатели
    "psychology":  [AgentRole.EXPERT, AgentRole.QUESTIONER, AgentRole.SYNTHESIZER],

    # Экономика / бизнес
    "economics":   [AgentRole.EXPERT, AgentRole.CRITIC, AgentRole.CONTRIBUTOR],
    "business":    [AgentRole.EXPERT, AgentRole.CONTRIBUTOR, AgentRole.CRITIC],

    # Искусство / литература / музыка — участники и наблюдатели
    "art":         [AgentRole.CONTRIBUTOR, AgentRole.OBSERVER, AgentRole.SUPPORTER],
    "painting":    [AgentRole.CONTRIBUTOR, AgentRole.OBSERVER, AgentRole.SUPPORTER],
    "literature":  [AgentRole.CONTRIBUTOR, AgentRole.SYNTHESIZER, AgentRole.QUESTIONER],
    "writer":      [AgentRole.CONTRIBUTOR, AgentRole.SYNTHESIZER, AgentRole.QUESTIONER],
    "music":       [AgentRole.CONTRIBUTOR, AgentRole.SUPPORTER, AgentRole.OBSERVER],
    "composer":    [AgentRole.CONTRIBUTOR, AgentRole.EXPERT, AgentRole.OBSERVER],

    # Образование
    "education":   [AgentRole.EXPERT, AgentRole.QUESTIONER, AgentRole.SYNTHESIZER],

    # Разведка / исследования
    "exploration": [AgentRole.CONTRIBUTOR, AgentRole.EXPERT, AgentRole.QUESTIONER],

    # Революция
    "revolution":  [AgentRole.LEADER, AgentRole.CRITIC, AgentRole.CONTRIBUTOR],
    "dictatorship":[AgentRole.LEADER, AgentRole.CRITIC, AgentRole.CONTRIBUTOR],
}


class AgentRoleService:
    """Сервис для управления динамическими ролями агентов"""
    
    def __init__(self):
        # История ролей агентов в разговорах
        self.conversation_roles: Dict[int, Dict[int, AgentRole]] = defaultdict(dict)
        
        # Статистика ролей
        self.role_statistics: Dict[int, Dict[AgentRole, int]] = defaultdict(lambda: defaultdict(int))
        
        # Временные метки последних изменений ролей
        self.role_timestamps: Dict[int, Dict[int, datetime]] = defaultdict(dict)
    
    def assign_role(
        self,
        agent: Dict[str, Any],
        conversation_id: int,
        conversation_context: List[Dict[str, Any]],
        interaction_type: Optional[str] = None
    ) -> AgentRole:
        """Назначить роль агенту на основе контекста
        
        Args:
            agent: Данные агента
            conversation_id: ID разговора
            conversation_context: Контекст разговора
            interaction_type: Тип взаимодействия
            
        Returns:
            Назначенная роль
        """
        agent_id = agent.get("id")
        
        # Проверяем текущую роль
        current_role = self.conversation_roles[conversation_id].get(agent_id)
        
        # Анализируем контекст для определения подходящей роли
        role = self._determine_role_from_context(
            agent, conversation_context, interaction_type, current_role
        )
        
        # Обновляем роль
        self.conversation_roles[conversation_id][agent_id] = role
        self.role_statistics[conversation_id][role] += 1
        self.role_timestamps[conversation_id][agent_id] = datetime.utcnow()
        
        logger.debug(f"Agent {agent_id} assigned role {role.value} in conversation {conversation_id}")
        
        return role
    
    def _get_category_preferred_role(self, agent: Dict[str, Any]) -> Optional[AgentRole]:
        """Вернуть роль, наиболее соответствующую категории персонажа.

        Если персонаж относится к нескольким категориям, используем первую совпадающую.
        """
        raw_category = agent.get("category", "")
        if not raw_category:
            return None
        # Категории разделены запятой; приводим к нижнему регистру и убираем пробелы
        categories = [c.strip().lower() for c in raw_category.split(",")]
        for cat in categories:
            preferred = CATEGORY_ROLE_PREFERENCES.get(cat)
            if preferred:
                # Берём первую роль из предпочтений (наиболее типичную)
                return preferred[0]
        return None

    def _determine_role_from_context(
        self,
        agent: Dict[str, Any],
        conversation_context: List[Dict[str, Any]],
        interaction_type: Optional[str] = None,
        current_role: Optional[AgentRole] = None
    ) -> AgentRole:
        """Определить роль из контекста с учётом категории персонажа."""

        # --- Базовая роль из категории персонажа ---
        category_role = self._get_category_preferred_role(agent)
        base_role = category_role or AgentRole.CONTRIBUTOR

        # Если разговор только начинается — возвращаем базовую роль персонажа
        if not conversation_context or len(conversation_context) < 2:
            return base_role

        # --- Анализ динамики последних реплик ---
        recent_messages = conversation_context[-5:]

        question_count = sum(1 for msg in recent_messages if "?" in msg.get("content", ""))
        agreement_count = sum(
            1 for msg in recent_messages
            if any(w in msg.get("content", "").lower()
                   for w in ["согласен", "поддерживаю", "верно", "agree", "correct", "именно"])
        )
        disagreement_count = sum(
            1 for msg in recent_messages
            if any(w in msg.get("content", "").lower()
                   for w in ["не согласен", "однако", "но", "disagree", "however", "хотя"])
        )

        # --- Определяем «ситуационную» роль на основе динамики ---
        # Не переназначаем если персонаж по природе не подходит
        raw_category = agent.get("category", "").lower()
        is_spiritual = any(c in raw_category for c in ["religion", "spirituality", "philosophy"])
        is_artist = any(c in raw_category for c in ["art", "painting", "music", "composer", "literature", "writer"])

        # Если в чате назрел синтез — только не для лидеров и художников
        if len(recent_messages) >= 4 and not is_spiritual and not is_artist:
            if question_count >= 2:
                return AgentRole.QUESTIONER
            if disagreement_count >= 2:
                # Критиком могут быть не все
                if base_role in (AgentRole.LEADER, AgentRole.EXPERT, AgentRole.CRITIC):
                    return AgentRole.CRITIC
            if agreement_count >= 3:
                return AgentRole.SYNTHESIZER

        # Прямые сигналы из interaction_type
        if interaction_type == "question" and not is_spiritual:
            return AgentRole.QUESTIONER
        if interaction_type == "disagreement" and base_role in (AgentRole.LEADER, AgentRole.EXPERT, AgentRole.CRITIC):
            return AgentRole.CRITIC

        # Для духовных/художественных персонажей — не меняем базовую роль по шаблонам
        # Сохраняем текущую роль если она уже была установлена и соответствует категории
        if current_role and current_role == base_role:
            return current_role

        return base_role
    
    def get_role(self, agent_id: int, conversation_id: int) -> AgentRole:
        """Получить текущую роль агента"""
        return self.conversation_roles[conversation_id].get(
            agent_id, AgentRole.CONTRIBUTOR
        )
    
    def get_role_instructions(
        self,
        agent: Dict[str, Any],
        role: AgentRole,
        conversation_context: List[Dict[str, Any]]
    ) -> str:
        """Получить инструкции для агента на основе его роли.

        Инструкции акцентируют функцию роли, но не диктуют стиль —
        стиль задаётся системным промптом персонажа.
        """
        agent_name = agent.get("name", "Агент")

        role_instructions = {
            AgentRole.LEADER: (
                f"{agent_name}, возьми инициативу в этом разговоре. "
                "Задай направление, предложи ключевой вопрос или тезис — "
                "именно так, как это сделал бы твой персонаж."
            ),
            AgentRole.EXPERT: (
                f"{agent_name}, опирайся на свои глубокие знания и опыт. "
                "Поделись тем, что знаешь лучше других собеседников, — "
                "конкретно и в своём характерном стиле."
            ),
            AgentRole.MODERATOR: (
                f"{agent_name}, помоги направить разговор: "
                "подчеркни ключевые моменты или задай вопрос, который продвинет дискуссию вперёд."
            ),
            AgentRole.QUESTIONER: (
                f"{agent_name}, задай вопрос, который тебя действительно интересует в связи с темой. "
                "Исследуй то, что осталось нераскрытым."
            ),
            AgentRole.SUPPORTER: (
                f"{agent_name}, подхвати мысль, с которой согласен, — "
                "дополни её своим взглядом или примером из собственного опыта."
            ),
            AgentRole.CRITIC: (
                f"{agent_name}, укажи на то, что кажется тебе сомнительным или неполным. "
                "Возражай или предлагай альтернативу — в своей манере, без лишней дипломатии."
            ),
            AgentRole.SYNTHESIZER: (
                f"{agent_name}, объедини прозвучавшие идеи. "
                "Найди то, что их связывает, или сформулируй общий вывод."
            ),
            AgentRole.CONTRIBUTOR: (
                f"{agent_name}, добавь свою реплику туда, где это уместно. "
                "Говори естественно, как ты всегда говоришь."
            ),
            AgentRole.OBSERVER: (
                f"{agent_name}, ты внимательно слушал. "
                "Вступи в разговор только если есть что-то действительно важное сказать."
            ),
        }

        instruction = role_instructions.get(role, role_instructions[AgentRole.CONTRIBUTOR])

        # Упоминаем, кто недавно говорил, если это не единственный агент
        if conversation_context:
            recent_speakers = [
                msg.get("agent_name", "")
                for msg in conversation_context[-3:]
                if not msg.get("is_from_user") and msg.get("agent_name") != agent_name
            ]
            unique_recent = list(dict.fromkeys(recent_speakers))  # порядок без дубликатов
            if unique_recent:
                instruction += (
                    f" (Только что высказались: {', '.join(unique_recent)} — "
                    "не повторяй их мысли дословно.)"
                )

        return instruction
    
    def should_agent_speak(
        self,
        agent_id: int,
        conversation_id: int,
        role: AgentRole,
        conversation_context: List[Dict[str, Any]]
    ) -> bool:
        """Определить, должен ли агент говорить на основе его роли"""
        
        # Разные роли имеют разную частоту выступлений
        role_speaking_probabilities = {
            AgentRole.LEADER: 0.8,
            AgentRole.EXPERT: 0.7,
            AgentRole.MODERATOR: 0.6,
            AgentRole.QUESTIONER: 0.7,
            AgentRole.CONTRIBUTOR: 0.5,
            AgentRole.SUPPORTER: 0.4,
            AgentRole.CRITIC: 0.5,
            AgentRole.SYNTHESIZER: 0.4,
            AgentRole.OBSERVER: 0.2,
        }
        
        base_probability = role_speaking_probabilities.get(role, 0.5)
        
        # Корректируем на основе контекста
        recent_agent_messages = sum(
            1 for msg in conversation_context[-5:]
            if msg.get("agent_id") == agent_id
        )
        
        # Если агент недавно говорил, снижаем вероятность
        if recent_agent_messages > 0:
            base_probability *= 0.6
        
        # Если агент долго молчал, увеличиваем вероятность
        if recent_agent_messages == 0 and len(conversation_context) >= 3:
            base_probability *= 1.3
            base_probability = min(base_probability, 0.9)
        
        return random.random() < base_probability
    
    def get_role_statistics(self, conversation_id: int) -> Dict[str, int]:
        """Получить статистику ролей в разговоре"""
        stats = self.role_statistics.get(conversation_id, {})
        return {role.value: count for role, count in stats.items()}
    
    def reset_conversation_roles(self, conversation_id: int):
        """Сбросить роли для разговора"""
        if conversation_id in self.conversation_roles:
            del self.conversation_roles[conversation_id]
        if conversation_id in self.role_statistics:
            del self.role_statistics[conversation_id]
        if conversation_id in self.role_timestamps:
            del self.role_timestamps[conversation_id]


















