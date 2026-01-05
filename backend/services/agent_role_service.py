from typing import List, Dict, Any, Optional
from enum import Enum
import logging
from collections import defaultdict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class AgentRole(str, Enum):
    """Роли агентов в разговоре"""
    LEADER = "leader"  # Лидер обсуждения - задает направление
    EXPERT = "expert"  # Эксперт - дает глубокие знания
    MODERATOR = "moderator"  # Модератор - поддерживает порядок
    CONTRIBUTOR = "contributor"  # Участник - вносит вклад
    QUESTIONER = "questioner"  # Вопрошающий - задает вопросы
    SUPPORTER = "supporter"  # Поддерживающий - соглашается и дополняет
    CRITIC = "critic"  # Критик - находит проблемы
    SYNTHESIZER = "synthesizer"  # Синтезатор - объединяет идеи
    OBSERVER = "observer"  # Наблюдатель - редко говорит, но внимательно слушает


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
    
    def _determine_role_from_context(
        self,
        agent: Dict[str, Any],
        conversation_context: List[Dict[str, Any]],
        interaction_type: Optional[str] = None,
        current_role: Optional[AgentRole] = None
    ) -> AgentRole:
        """Определить роль из контекста"""
        
        # Если это начало разговора
        if not conversation_context or len(conversation_context) < 2:
            # Анализируем категорию и описание агента
            category = agent.get("category", "").lower()
            description = agent.get("description", "").lower()
            
            if "эксперт" in description or "expert" in description:
                return AgentRole.EXPERT
            elif "модератор" in description or "moderator" in description:
                return AgentRole.MODERATOR
            elif category in ["technical", "science"]:
                return AgentRole.EXPERT
            else:
                return AgentRole.CONTRIBUTOR
        
        # Анализируем последние сообщения
        recent_messages = conversation_context[-5:] if len(conversation_context) >= 5 else conversation_context
        
        # Подсчитываем типы взаимодействий
        question_count = sum(1 for msg in recent_messages if "?" in msg.get("content", ""))
        agreement_count = sum(1 for msg in recent_messages 
                            if any(word in msg.get("content", "").lower() 
                                  for word in ["согласен", "поддерживаю", "верно", "agree", "correct"]))
        disagreement_count = sum(1 for msg in recent_messages 
                                if any(word in msg.get("content", "").lower() 
                                      for word in ["не согласен", "но", "однако", "disagree", "however"]))
        
        # Определяем роль на основе паттернов
        if question_count >= 2:
            return AgentRole.QUESTIONER
        elif agreement_count >= 2:
            return AgentRole.SUPPORTER
        elif disagreement_count >= 2:
            return AgentRole.CRITIC
        elif len(recent_messages) >= 4:
            # Если много сообщений, нужен синтезатор
            return AgentRole.SYNTHESIZER
        elif interaction_type == "question":
            return AgentRole.QUESTIONER
        elif interaction_type == "disagreement":
            return AgentRole.CRITIC
        else:
            # Сохраняем текущую роль или назначаем базовую
            return current_role or AgentRole.CONTRIBUTOR
    
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
        """Получить инструкции для агента на основе его роли"""
        agent_name = agent.get("name", "Агент")
        
        role_instructions = {
            AgentRole.LEADER: (
                f"{agent_name}, ты лидер этого обсуждения. "
                "Задавай направление разговора, формулируй ключевые вопросы, "
                "подводи промежуточные итоги. Будь активным и инициативным."
            ),
            AgentRole.EXPERT: (
                f"{agent_name}, ты эксперт в этой области. "
                "Предоставляй глубокие знания, факты, примеры из практики. "
                "Будь точным и авторитетным, но не высокомерным."
            ),
            AgentRole.MODERATOR: (
                f"{agent_name}, ты модератор обсуждения. "
                "Поддерживай порядок, следи за тем, чтобы все могли высказаться, "
                "резюмируй ключевые моменты. Будь нейтральным и справедливым."
            ),
            AgentRole.QUESTIONER: (
                f"{agent_name}, твоя роль - задавать важные вопросы. "
                "Глубоко исследуй тему, уточняй детали, помогай раскрыть проблему. "
                "Твои вопросы должны быть конструктивными и полезными."
            ),
            AgentRole.SUPPORTER: (
                f"{agent_name}, ты поддерживаешь и дополняешь идеи других. "
                "Соглашайся, когда это уместно, добавляй свои мысли, "
                "развивай предложения других участников. Будь позитивным и конструктивным."
            ),
            AgentRole.CRITIC: (
                f"{agent_name}, твоя роль - конструктивная критика. "
                "Находи потенциальные проблемы, указывай на слабые места, "
                "предлагай альтернативы. Будь честным, но уважительным."
            ),
            AgentRole.SYNTHESIZER: (
                f"{agent_name}, твоя роль - синтезировать идеи. "
                "Объединяй различные точки зрения, находи общие паттерны, "
                "создавай целостную картину. Будь аналитичным и системным."
            ),
            AgentRole.CONTRIBUTOR: (
                f"{agent_name}, ты активный участник обсуждения. "
                "Вноси свой вклад, делись знаниями и опытом, "
                "взаимодействуй с другими участниками естественно."
            ),
            AgentRole.OBSERVER: (
                f"{agent_name}, ты внимательный наблюдатель. "
                "Слушай внимательно, вступай в разговор только когда есть что-то важное добавить. "
                "Твои комментарии должны быть продуманными и ценными."
            ),
        }
        
        base_instruction = role_instructions.get(role, role_instructions[AgentRole.CONTRIBUTOR])
        
        # Добавляем контекстные подсказки
        if conversation_context:
            recent_speakers = [msg.get("agent_name", "Агент") 
                             for msg in conversation_context[-3:] 
                             if not msg.get("is_from_user")]
            if recent_speakers:
                unique_speakers = list(set(recent_speakers))
                if len(unique_speakers) > 1:
                    base_instruction += (
                        f"\n\nНедавно высказались: {', '.join(unique_speakers)}. "
                        "Учти их мнения в своем ответе."
                    )
        
        return base_instruction
    
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
        
        import random
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


















