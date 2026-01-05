from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class AgentMemoryService:
    """Сервис для управления памятью взаимодействий между агентами"""
    
    def __init__(self):
        # Память взаимодействий: agent_pair -> List[interactions]
        self.interaction_memory: Dict[Tuple[int, int], List[Dict[str, Any]]] = defaultdict(list)
        
        # История тем разговоров для каждого агента
        self.agent_topics: Dict[int, List[str]] = defaultdict(list)
        
        # Предпочтения агентов (что им нравится/не нравится)
        self.agent_preferences: Dict[int, Dict[str, Any]] = defaultdict(dict)
        
        # Временные метки последних взаимодействий
        self.last_interaction_times: Dict[Tuple[int, int], datetime] = {}
    
    def record_interaction(
        self,
        agent1_id: int,
        agent2_id: int,
        interaction_type: str,
        context: str,
        sentiment: str = "neutral"
    ):
        """Записать взаимодействие между двумя агентами"""
        pair = self._normalize_pair(agent1_id, agent2_id)
        
        interaction = {
            "timestamp": datetime.utcnow(),
            "type": interaction_type,
            "context": context,
            "sentiment": sentiment
        }
        
        self.interaction_memory[pair].append(interaction)
        self.last_interaction_times[pair] = datetime.utcnow()
        
        # Ограничиваем размер памяти (храним последние 50 взаимодействий)
        if len(self.interaction_memory[pair]) > 50:
            self.interaction_memory[pair] = self.interaction_memory[pair][-50:]
    
    def get_interaction_history(
        self,
        agent1_id: int,
        agent2_id: int,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Получить историю взаимодействий между двумя агентами"""
        pair = self._normalize_pair(agent1_id, agent2_id)
        history = self.interaction_memory.get(pair, [])
        return history[-limit:]
    
    def get_interaction_pattern(
        self,
        agent1_id: int,
        agent2_id: int
    ) -> Dict[str, Any]:
        """Получить паттерн взаимодействий между агентами"""
        pair = self._normalize_pair(agent1_id, agent2_id)
        interactions = self.interaction_memory.get(pair, [])
        
        if not interactions:
            return {
                "total_interactions": 0,
                "most_common_type": None,
                "average_sentiment": "neutral",
                "relationship": "unknown"
            }
        
        # Подсчитываем типы взаимодействий
        type_counts = defaultdict(int)
        sentiment_counts = defaultdict(int)
        
        for interaction in interactions:
            type_counts[interaction["type"]] += 1
            sentiment_counts[interaction["sentiment"]] += 1
        
        most_common_type = max(type_counts.items(), key=lambda x: x[1])[0] if type_counts else None
        most_common_sentiment = max(sentiment_counts.items(), key=lambda x: x[1])[0] if sentiment_counts else "neutral"
        
        # Определяем тип отношений
        relationship = self._determine_relationship(interactions, most_common_sentiment)
        
        return {
            "total_interactions": len(interactions),
            "most_common_type": most_common_type,
            "average_sentiment": most_common_sentiment,
            "relationship": relationship,
            "last_interaction": interactions[-1]["timestamp"] if interactions else None
        }
    
    def _determine_relationship(
        self,
        interactions: List[Dict[str, Any]],
        dominant_sentiment: str
    ) -> str:
        """Определить тип отношений между агентами"""
        if not interactions:
            return "unknown"
        
        # Анализируем последние взаимодействия
        recent = interactions[-10:] if len(interactions) >= 10 else interactions
        
        agreement_count = sum(1 for i in recent if i["type"] == "agreement")
        disagreement_count = sum(1 for i in recent if i["type"] == "disagreement")
        
        if agreement_count > disagreement_count * 2:
            return "collaborative"
        elif disagreement_count > agreement_count * 2:
            return "debating"
        elif dominant_sentiment == "positive":
            return "supportive"
        elif dominant_sentiment == "negative":
            return "competitive"
        else:
            return "neutral"
    
    def record_topic(
        self,
        agent_id: int,
        topic: str,
        relevance: float = 1.0
    ):
        """Записать тему, в которой участвовал агент"""
        if topic not in self.agent_topics[agent_id]:
            self.agent_topics[agent_id].append(topic)
        
        # Ограничиваем размер (храним последние 20 тем)
        if len(self.agent_topics[agent_id]) > 20:
            self.agent_topics[agent_id] = self.agent_topics[agent_id][-20:]
    
    def get_agent_expertise_topics(self, agent_id: int) -> List[str]:
        """Получить темы, в которых агент проявлял экспертизу"""
        return self.agent_topics.get(agent_id, [])
    
    def should_agents_interact(
        self,
        agent1_id: int,
        agent2_id: int,
        current_context: str
    ) -> Tuple[bool, str]:
        """Определить, должны ли агенты взаимодействовать
        
        Returns:
            Tuple[should_interact, reason]
        """
        pattern = self.get_interaction_pattern(agent1_id, agent2_id)
        
        # Если агенты часто взаимодействуют положительно
        if pattern["relationship"] == "collaborative":
            return (True, "Агенты имеют историю успешного сотрудничества")
        
        # Если агенты в дебатах
        if pattern["relationship"] == "debating":
            return (True, "Агенты имеют историю конструктивных дебатов")
        
        # Если давно не взаимодействовали
        last_interaction = pattern.get("last_interaction")
        if last_interaction:
            time_since = datetime.utcnow() - last_interaction
            if time_since > timedelta(hours=1):  # Условно: 1 час
                return (True, "Агенты давно не взаимодействовали")
        
        # Если нет истории взаимодействий
        if pattern["total_interactions"] == 0:
            return (True, "Первое взаимодействие между агентами")
        
        return (False, "Нет достаточных оснований для взаимодействия")
    
    def build_memory_context(
        self,
        agent_id: int,
        other_agents: List[Dict[str, Any]],
        conversation_context: List[Dict[str, Any]]
    ) -> str:
        """Построить контекст из памяти для агента"""
        context_parts = []
        
        # Добавляем информацию о предыдущих взаимодействиях
        for other_agent in other_agents:
            other_id = other_agent.get("id")
            if other_id == agent_id:
                continue
            
            pattern = self.get_interaction_pattern(agent_id, other_id)
            if pattern["total_interactions"] > 0:
                relationship = pattern["relationship"]
                context_parts.append(
                    f"С {other_agent.get('name', 'Агентом')} у тебя "
                    f"{relationship} отношения ({pattern['total_interactions']} взаимодействий). "
                    f"Последнее взаимодействие: {pattern.get('last_interaction', 'давно')}"
                )
        
        # Добавляем темы экспертизы
        expertise = self.get_agent_expertise_topics(agent_id)
        if expertise:
            context_parts.append(
                f"Твои предыдущие темы экспертизы: {', '.join(expertise[-5:])}"
            )
        
        if context_parts:
            return "\n".join(context_parts)
        
        return ""
    
    def _normalize_pair(self, id1: int, id2: int) -> Tuple[int, int]:
        """Нормализовать пару ID (меньший ID всегда первый)"""
        return (min(id1, id2), max(id1, id2))
    
    def clear_agent_memory(self, agent_id: int):
        """Очистить память для конкретного агента"""
        # Удаляем все взаимодействия с участием этого агента
        pairs_to_remove = [
            pair for pair in self.interaction_memory.keys()
            if agent_id in pair
        ]
        
        for pair in pairs_to_remove:
            del self.interaction_memory[pair]
            if pair in self.last_interaction_times:
                del self.last_interaction_times[pair]
        
        # Очищаем темы и предпочтения
        if agent_id in self.agent_topics:
            del self.agent_topics[agent_id]
        if agent_id in self.agent_preferences:
            del self.agent_preferences[agent_id]
    
    def clear_conversation_memory(self, conversation_id: int):
        """Очистить память для конкретного разговора"""
        # В текущей реализации память не привязана к разговорам,
        # но можно добавить эту функциональность при необходимости
        pass


















