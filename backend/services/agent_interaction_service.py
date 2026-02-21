from typing import Dict, Any, List, Optional, Tuple
from enum import Enum
from datetime import datetime
import logging
import re
import random
from collections import defaultdict

logger = logging.getLogger(__name__)


class InteractionType(str, Enum):
    """Типы взаимодействия между агентами"""
    AGREEMENT = "agreement"  # Согласие
    DISAGREEMENT = "disagreement"  # Несогласие
    ADDITION = "addition"  # Дополнение
    QUESTION = "question"  # Вопрос
    CLARIFICATION = "clarification"  # Уточнение
    EXAMPLE = "example"  # Пример
    COUNTER_ARGUMENT = "counter_argument"  # Контраргумент
    NEUTRAL = "neutral"  # Нейтральный ответ


class EmotionalTone(str, Enum):
    """Эмоциональный тон сообщения"""
    POSITIVE = "positive"  # Позитивный
    NEGATIVE = "negative"  # Негативный
    NEUTRAL = "neutral"  # Нейтральный
    EXCITED = "excited"  # Взволнованный
    SKEPTICAL = "skeptical"  # Скептический
    SUPPORTIVE = "supportive"  # Поддерживающий
    CRITICAL = "critical"  # Критический


class InteractionPattern(str, Enum):
    """Паттерны взаимодействия между агентами"""
    DEBATE = "debate"  # Дебаты
    BRAINSTORM = "brainstorm"  # Мозговой штурм
    QNA = "qna"  # Вопрос-ответ
    COLLABORATION = "collaboration"  # Сотрудничество
    CONFLICT = "conflict"  # Конфликт
    CONSENSUS = "consensus"  # Консенсус
    EXPLORATION = "exploration"  # Исследование
    NEUTRAL = "neutral"  # Нейтральный


class AgentInteractionService:
    """Унифицированный сервис для анализа и управления взаимодействием между агентами"""
    
    def __init__(self):
        # Паттерны для определения типа взаимодействия
        self.agreement_patterns = [
            r"соглас[ен|на|ен|ны]", r"поддерживаю", r"верно", r"правильно",
            r"точно", r"именно", r"да,", r"absolutely", r"agree", r"correct"
        ]
        
        self.disagreement_patterns = [
            r"не соглас[ен|на|ен|ны]", r"не думаю", r"неверно", r"неправильно",
            r"но", r"однако", r"хотя", r"disagree", r"however", r"but"
        ]
        
        self.question_patterns = [
            r"\?", r"как", r"что", r"почему", r"когда", r"где", r"кто",
            r"how", r"what", r"why", r"when", r"where", r"who"
        ]
        
        self.addition_patterns = [
            r"также", r"ещё", r"дополню", r"добавлю", r"кроме того",
            r"also", r"additionally", r"moreover", r"furthermore"
        ]
        
        # Паттерны для анализа эмоций
        self.emotional_patterns = {
            EmotionalTone.POSITIVE: [
                r"отлично", r"замечательно", r"прекрасно", r"великолепно",
                r"excellent", r"great", r"wonderful", r"amazing"
            ],
            EmotionalTone.NEGATIVE: [
                r"плохо", r"ужасно", r"неправильно", r"ошибка",
                r"bad", r"terrible", r"wrong", r"error"
            ],
            EmotionalTone.EXCITED: [
                r"вау", r"невероятно", r"потрясающе", r"интересно",
                r"wow", r"incredible", r"amazing", r"interesting"
            ],
            EmotionalTone.SKEPTICAL: [
                r"сомневаюсь", r"не уверен", r"возможно", r"может быть",
                r"doubt", r"not sure", r"maybe", r"perhaps"
            ],
            EmotionalTone.SUPPORTIVE: [
                r"поддерживаю", r"согласен", r"верно", r"правильно",
                r"support", r"agree", r"correct", r"right"
            ],
            EmotionalTone.CRITICAL: [
                r"критично", r"проблема", r"недостаток", r"слабость",
                r"critical", r"problem", r"weakness", r"flaw"
            ]
        }
        
        # Состояния агентов (упрощенное хранение)
        self.agent_participation: Dict[int, Dict[int, int]] = defaultdict(dict)  # conversation_id -> agent_id -> count
    
        # Эмоциональная динамика агентов
        self.agent_emotional_state: Dict[int, Dict[int, EmotionalTone]] = defaultdict(dict)  # conversation_id -> agent_id -> tone
        self.emotional_history: Dict[int, List[EmotionalTone]] = defaultdict(list)  # conversation_id -> tones
        
        # Эмоциональная инерция (тенденция сохранять текущий эмоциональный тон)
        self.emotional_inertia: Dict[int, float] = defaultdict(lambda: 0.3)  # conversation_id -> inertia_factor
    
    def analyze_interaction_type(
        self,
        agent_response: str,
        previous_messages: List[Dict[str, Any]]
    ) -> InteractionType:
        """Проанализировать тип взаимодействия агента"""
        response_lower = agent_response.lower()
        
        # Проверяем наличие вопросов
        if any(re.search(pattern, response_lower) for pattern in self.question_patterns):
            if any(word in response_lower for word in ["уточни", "поясни", "explain", "clarify"]):
                return InteractionType.CLARIFICATION
            return InteractionType.QUESTION
        
        # Проверяем согласие
        if any(re.search(pattern, response_lower) for pattern in self.agreement_patterns):
            return InteractionType.AGREEMENT
        
        # Проверяем несогласие
        if any(re.search(pattern, response_lower) for pattern in self.disagreement_patterns):
            return InteractionType.DISAGREEMENT
        
        # Проверяем дополнение
        if any(re.search(pattern, response_lower) for pattern in self.addition_patterns):
            return InteractionType.ADDITION
        
        # Проверяем наличие примеров
        if any(word in response_lower for word in ["например", "пример", "example", "instance"]):
            return InteractionType.EXAMPLE
        
        # Контраргумент
        if any(word in response_lower for word in ["с другой стороны", "on the other hand"]):
            return InteractionType.COUNTER_ARGUMENT
        
        return InteractionType.NEUTRAL
    
    def analyze_emotional_tone(self, message: str) -> EmotionalTone:
        """Проанализировать эмоциональный тон сообщения"""
        message_lower = message.lower()
        
        tone_scores = defaultdict(int)
        for tone, patterns in self.emotional_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    tone_scores[tone] += 1
        
        if not tone_scores:
            return EmotionalTone.NEUTRAL
        
        # Выбираем тон с наибольшим количеством совпадений
        dominant_tone = max(tone_scores.items(), key=lambda x: x[1])[0]
        
        # Если есть и позитивные, и негативные сигналы, определяем баланс
        if EmotionalTone.POSITIVE in tone_scores and EmotionalTone.NEGATIVE in tone_scores:
            if tone_scores[EmotionalTone.POSITIVE] > tone_scores[EmotionalTone.NEGATIVE]:
                return EmotionalTone.POSITIVE
            elif tone_scores[EmotionalTone.NEGATIVE] > tone_scores[EmotionalTone.POSITIVE]:
                return EmotionalTone.NEGATIVE
        
        return dominant_tone
    
    def analyze_emotional_dynamics(
        self,
        conversation_id: int,
        agent_id: int,
        new_tone: EmotionalTone,
        previous_messages: List[Dict[str, Any]]
    ) -> EmotionalTone:
        """Анализировать эмоциональную динамику с учетом истории
        
        Учитывает предыдущие эмоциональные состояния и создает более естественные переходы
        """
        # Получаем предыдущее эмоциональное состояние агента
        previous_tone = self.agent_emotional_state[conversation_id].get(agent_id, EmotionalTone.NEUTRAL)
        
        # Получаем эмоциональную историю разговора
        emotional_history = self.emotional_history[conversation_id]
        
        # Эмоциональная инерция - тенденция сохранять текущий тон
        inertia = self.emotional_inertia[conversation_id]
        
        # Если есть история, учитываем общий эмоциональный климат
        if emotional_history:
            recent_tones = emotional_history[-5:] if len(emotional_history) >= 5 else emotional_history
            
            # Подсчитываем доминирующий тон в разговоре
            tone_counts = defaultdict(int)
            for tone in recent_tones:
                tone_counts[tone] += 1
            
            dominant_conversation_tone = max(tone_counts.items(), key=lambda x: x[1])[0] if tone_counts else EmotionalTone.NEUTRAL
            
            # Если новый тон сильно отличается от доминирующего, смягчаем переход
            if new_tone != dominant_conversation_tone:
                # Проверяем, является ли переход резким
                is_drastic = self._is_drastic_emotional_change(previous_tone, new_tone)
                
                if is_drastic and inertia > 0.2:
                    # Смягчаем переход - возвращаем промежуточный тон
                    return self._get_intermediate_tone(previous_tone, new_tone)
        
        # Обновляем состояние
        self.agent_emotional_state[conversation_id][agent_id] = new_tone
        self.emotional_history[conversation_id].append(new_tone)
        
        # Ограничиваем размер истории
        if len(self.emotional_history[conversation_id]) > 20:
            self.emotional_history[conversation_id] = self.emotional_history[conversation_id][-20:]
        
        return new_tone
    
    def _is_drastic_emotional_change(
        self,
        tone1: EmotionalTone,
        tone2: EmotionalTone
    ) -> bool:
        """Проверить, является ли переход между тонами резким"""
        drastic_pairs = [
            (EmotionalTone.POSITIVE, EmotionalTone.NEGATIVE),
            (EmotionalTone.NEGATIVE, EmotionalTone.POSITIVE),
            (EmotionalTone.EXCITED, EmotionalTone.CRITICAL),
            (EmotionalTone.CRITICAL, EmotionalTone.EXCITED),
        ]
        
        return (tone1, tone2) in drastic_pairs or (tone2, tone1) in drastic_pairs
    
    def _get_intermediate_tone(
        self,
        tone1: EmotionalTone,
        tone2: EmotionalTone
    ) -> EmotionalTone:
        """Получить промежуточный тон между двумя тонами"""
        # Матрица промежуточных тонов
        intermediate_map = {
            (EmotionalTone.POSITIVE, EmotionalTone.NEGATIVE): EmotionalTone.NEUTRAL,
            (EmotionalTone.NEGATIVE, EmotionalTone.POSITIVE): EmotionalTone.NEUTRAL,
            (EmotionalTone.EXCITED, EmotionalTone.CRITICAL): EmotionalTone.NEUTRAL,
            (EmotionalTone.CRITICAL, EmotionalTone.EXCITED): EmotionalTone.NEUTRAL,
            (EmotionalTone.POSITIVE, EmotionalTone.CRITICAL): EmotionalTone.SKEPTICAL,
            (EmotionalTone.CRITICAL, EmotionalTone.POSITIVE): EmotionalTone.SKEPTICAL,
        }
        
        key = (tone1, tone2)
        if key in intermediate_map:
            return intermediate_map[key]
        
        # Если нет специального промежуточного тона, возвращаем нейтральный
        return EmotionalTone.NEUTRAL
    
    def get_conversation_emotional_climate(
        self,
        conversation_id: int
    ) -> Dict[str, Any]:
        """Получить общий эмоциональный климат разговора"""
        emotional_history = self.emotional_history.get(conversation_id, [])
        
        if not emotional_history:
            return {
                "dominant_tone": EmotionalTone.NEUTRAL.value,
                "stability": 1.0,
                "trend": "stable"
            }
        
        # Подсчитываем частоту тонов
        tone_counts = defaultdict(int)
        for tone in emotional_history:
            tone_counts[tone] += 1
        
        dominant_tone = max(tone_counts.items(), key=lambda x: x[1])[0]
        
        # Вычисляем стабильность (насколько часто меняется тон)
        changes = sum(1 for i in range(1, len(emotional_history))
                     if emotional_history[i] != emotional_history[i-1])
        stability = 1.0 - (changes / len(emotional_history)) if emotional_history else 1.0
        
        # Определяем тренд (улучшается/ухудшается/стабильно)
        recent = emotional_history[-5:] if len(emotional_history) >= 5 else emotional_history
        positive_count = sum(1 for t in recent if t in [EmotionalTone.POSITIVE, EmotionalTone.EXCITED, EmotionalTone.SUPPORTIVE])
        negative_count = sum(1 for t in recent if t in [EmotionalTone.NEGATIVE, EmotionalTone.CRITICAL])
        
        if positive_count > negative_count:
            trend = "improving"
        elif negative_count > positive_count:
            trend = "declining"
        else:
            trend = "stable"
        
        return {
            "dominant_tone": dominant_tone.value,
            "stability": stability,
            "trend": trend,
            "tone_distribution": {tone.value: count for tone, count in tone_counts.items()}
        }
    
    def should_agent_respond(
        self,
        agent: Dict[str, Any],
        interaction_type: InteractionType,
        previous_messages: List[Dict[str, Any]],
        agent_participation_count: int,
        conversation_id: Optional[int] = None
    ) -> bool:
        """Определить, должен ли агент ответить на основе типа взаимодействия"""
        # Если агент уже много говорил, снижаем вероятность
        if agent_participation_count >= 2:
            return False
        
        # Разные типы взаимодействия требуют разных ответов
        response_probabilities = {
            InteractionType.QUESTION: 0.8,
            InteractionType.DISAGREEMENT: 0.7,
            InteractionType.CLARIFICATION: 0.6,
            InteractionType.COUNTER_ARGUMENT: 0.5,
            InteractionType.ADDITION: 0.4,
            InteractionType.AGREEMENT: 0.3,
            InteractionType.EXAMPLE: 0.3,
            InteractionType.NEUTRAL: 0.2,
        }
        
        probability = response_probabilities.get(interaction_type, 0.3)
        
        # Учитываем участие агента в разговоре
        if conversation_id:
            total_participation = self.agent_participation[conversation_id].get(agent.get("id"), 0)
            if total_participation >= 3:
                probability *= 0.5  # Снижаем вероятность для слишком активных
        
        return random.random() < probability
    
    def build_context_for_agent(
        self,
        agent: Dict[str, Any],
        user_message: str,
        previous_responses: List[Dict[str, Any]],
        interaction_type: Optional[InteractionType] = None,
        conversation_pattern: Optional[InteractionPattern] = None,
        agent_own_history: Optional[List[str]] = None,  # Agent's own previous messages
        all_discussed_points: Optional[List[str]] = None  # Key points already discussed
    ) -> str:
        """Построить контекст для агента с учётом типа взаимодействия.

        Формат ориентирован на то, чтобы персонаж видел разговор как живой диалог,
        а не как список инструкций. Метаинструкции сформулированы кратко и не навязчиво.
        """
        agent_name = agent.get("name", "Агент")
        parts: List[str] = []

        # --- Сообщение пользователя ---
        parts.append(f"Пользователь написал: {user_message}")

        # --- Ответы других участников (если есть) ---
        if previous_responses:
            parts.append("\nНа это уже ответили:")
            # Show up to 5 recent messages (optimized for tokens)
            recent_responses = previous_responses[-5:] if len(previous_responses) > 5 else previous_responses
            for resp in recent_responses:
                name = resp.get("agent_name", "Агент")
                msg = (resp.get("message") or "").strip()
                if msg:
                    # Shorter snippets to save tokens (up to 200 chars)
                    snippet = msg[:200] + ("…" if len(msg) > 200 else "")
                    parts.append(f"  {name}: {snippet}")

        # --- Agent's own previous messages (to prevent self-repetition) ---
        if agent_own_history and len(agent_own_history) > 0:
            parts.append(f"\n[Ты уже говорил:]")
            # Show only last 1-2 own messages to save tokens
            own_msgs_to_show = agent_own_history[-2:] if len(agent_own_history) > 1 else agent_own_history[-1:]
            for i, own_msg in enumerate(own_msgs_to_show, 1):
                snippet = own_msg[:150] + ("…" if len(own_msg) > 150 else "")
                parts.append(f"  {i}. {snippet}")

        # --- Key points already discussed (only for longer conversations) ---
        if all_discussed_points and len(all_discussed_points) > 0 and len(previous_responses) > 5:
            parts.append(f"\n[Уже сказано — не повторяй:]")
            for point in all_discussed_points[-3:]:  # Show last 3 key points only
                parts.append(f"  • {point}")

        # --- Подсказка о характере текущего обмена ---
        pattern_hints = {
            InteractionPattern.DEBATE:       "В разговоре возникли разные точки зрения.",
            InteractionPattern.CONFLICT:     "Участники не соглашаются друг с другом.",
            InteractionPattern.CONSENSUS:    "Участники сходятся во мнениях.",
            InteractionPattern.BRAINSTORM:   "Идёт совместный поиск идей.",
            InteractionPattern.QNA:          "Участники отвечают на вопрос.",
            InteractionPattern.EXPLORATION:  "Тема исследуется сообща.",
            InteractionPattern.COLLABORATION:"Участники работают вместе.",
        }
        if conversation_pattern and conversation_pattern in pattern_hints:
            parts.append(f"\n[{pattern_hints[conversation_pattern]}]")

        # --- Stronger anti-duplication instruction ---
        turn_hints = {
            InteractionType.QUESTION: (
                f"Теперь слово {agent_name}. Ответь на вопрос в своей манере. "
                f"НЕ повторяй то, что уже сказано выше — предложи что-то новое."
            ),
            InteractionType.DISAGREEMENT: (
                f"Теперь слово {agent_name}. Выскажи свою позицию — согласись или возрази. "
                f"НЕ повторяй чужие аргументы — вырази СВОЮ уникальную точку зрения."
            ),
            InteractionType.AGREEMENT: (
                f"Теперь слово {agent_name}. Если согласен — НЕ повторяй то же самое. "
                f"Вместо этого: добавь новый пример, развей мысль дальше или предложи следующий шаг."
            ),
            InteractionType.ADDITION: (
                f"Теперь слово {agent_name}. Добавь свой взгляд на тему. "
                f"Обязательно скажи что-то НОВОЕ, чего ещё не было в разговоре."
            ),
        }
        hint = turn_hints.get(
            interaction_type,
            f"Теперь слово {agent_name}. Отвечай естественно. "
            f"ВАЖНО: НЕ повторяй уже сказанное — внеси в разговор что-то оригинальное."
        )
        parts.append(f"\n{hint}")

        return "\n".join(parts)
    
    def check_message_similarity(
        self,
        new_message: str,
        previous_messages: List[str],
        threshold: float = 0.7
    ) -> Tuple[bool, Optional[str]]:
        """Проверить, не повторяет ли новое сообщение предыдущие
        
        Args:
            new_message: Новое сообщение для проверки
            previous_messages: Список предыдущих сообщений
            threshold: Порог схожести (0.0 - 1.0)
            
        Returns:
            Tuple[bool, Optional[str]]: (является ли повторением, наиболее похожее сообщение)
        """
        if not previous_messages:
            return False, None
        
        new_lower = new_message.lower().strip()
        new_words = set(new_lower.split())
        
        if len(new_words) < 3:  # Слишком короткое сообщение
            return False, None
        
        max_similarity = 0.0
        most_similar = None
        
        for prev_msg in previous_messages:
            prev_lower = prev_msg.lower().strip()
            prev_words = set(prev_lower.split())
            
            if len(prev_words) < 3:
                continue
            
            # Вычисляем коэффициент Жаккара (пересечение / объединение)
            intersection = new_words.intersection(prev_words)
            union = new_words.union(prev_words)
            
            if len(union) == 0:
                continue
            
            similarity = len(intersection) / len(union)
            
            # Дополнительная проверка на длинные общие фразы
            if len(intersection) >= 5:  # Если много общих слов
                # Проверяем, есть ли длинные общие последовательности
                new_phrases = self._extract_phrases(new_lower)
                prev_phrases = self._extract_phrases(prev_lower)
                
                common_phrases = set(new_phrases).intersection(set(prev_phrases))
                if common_phrases:
                    # Увеличиваем схожесть за счет общих фраз
                    phrase_bonus = len(common_phrases) * 0.2
                    similarity = min(similarity + phrase_bonus, 1.0)
            
            if similarity > max_similarity:
                max_similarity = similarity
                most_similar = prev_msg
        
        is_repetition = max_similarity >= threshold
        return is_repetition, most_similar
    
    def _extract_phrases(self, text: str, min_length: int = 4) -> List[str]:
        """Извлечь фразы из текста (последовательности из 3-4 слов)"""
        words = text.split()
        phrases = []
        
        for i in range(len(words) - 2):
            phrase = " ".join(words[i:i+3])
            if len(phrase) >= min_length:
                phrases.append(phrase)
        
        return phrases
    
    def determine_dialogue_flow(
        self,
        recent_responses: List[Dict[str, Any]],
        agents: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Определить направление развития диалога"""
        if not recent_responses:
            return {
                "should_continue": False,
                "next_interaction_type": InteractionType.NEUTRAL,
                "priority_agents": [],
                "pattern": InteractionPattern.NEUTRAL
            }
        
        # Анализируем последние ответы
        interaction_types = []
        emotional_tones = []
        
        for response in recent_responses[-3:]:
            msg = response.get("message", "")
            interaction_type = self.analyze_interaction_type(msg, recent_responses)
            emotional_tone = self.analyze_emotional_tone(msg)
            interaction_types.append(interaction_type)
            emotional_tones.append(emotional_tone)
        
        # Определяем паттерн взаимодействия
        pattern = self._detect_interaction_pattern(recent_responses, emotional_tones)
        
        # Определяем, нужно ли продолжать
        should_continue = False
        next_interaction_type = InteractionType.NEUTRAL
        
        if InteractionType.QUESTION in interaction_types:
            should_continue = True
            next_interaction_type = InteractionType.CLARIFICATION
        elif InteractionType.DISAGREEMENT in interaction_types:
            should_continue = True
            next_interaction_type = InteractionType.COUNTER_ARGUMENT
        elif interaction_types.count(InteractionType.ADDITION) >= 2:
            should_continue = True
            next_interaction_type = InteractionType.ADDITION
        elif pattern in [InteractionPattern.CONFLICT, InteractionPattern.DEBATE]:
            should_continue = True
        
        # Определяем приоритетных агентов
        priority_agents = []
        if should_continue:
            responded_agent_ids = {r.get("agent_id") for r in recent_responses}
            priority_agents = [
                agent for agent in agents 
                if agent.get("id") not in responded_agent_ids
            ]
        
        return {
            "should_continue": should_continue,
            "next_interaction_type": next_interaction_type,
            "priority_agents": priority_agents,
            "recent_interaction_types": interaction_types,
            "pattern": pattern
        }
    
    def _detect_interaction_pattern(
        self,
        messages: List[Dict[str, Any]],
        emotional_tones: List[EmotionalTone]
    ) -> InteractionPattern:
        """Определить текущий паттерн взаимодействия"""
        if not messages:
            return InteractionPattern.EXPLORATION
        
        recent_messages = messages[-5:]
        
        # Анализируем эмоциональный баланс
        conflict_count = sum(1 for tone in emotional_tones 
                           if tone in [EmotionalTone.CRITICAL, EmotionalTone.SKEPTICAL, EmotionalTone.NEGATIVE])
        supportive_count = sum(1 for tone in emotional_tones 
                              if tone in [EmotionalTone.SUPPORTIVE, EmotionalTone.POSITIVE])
        
        if conflict_count >= 3:
            return InteractionPattern.CONFLICT
        if supportive_count >= 4:
            return InteractionPattern.CONSENSUS
        
        # Подсчитываем вопросы
        question_count = sum(1 for msg in recent_messages if "?" in msg.get("message", ""))
        if question_count >= 3:
            return InteractionPattern.QNA
        
        # Подсчитываем идеи
        idea_keywords = ["идея", "предложение", "можно", "idea", "suggest"]
        idea_count = sum(1 for msg in recent_messages 
                        if any(keyword in msg.get("message", "").lower() for keyword in idea_keywords))
        if idea_count >= 3:
            return InteractionPattern.BRAINSTORM
        
        # Дебаты
        disagreement_keywords = ["но", "однако", "хотя", "however", "but"]
        disagreement_count = sum(1 for msg in recent_messages 
                                if any(keyword in msg.get("message", "").lower() for keyword in disagreement_keywords))
        if disagreement_count >= 2:
            return InteractionPattern.DEBATE
        
        return InteractionPattern.EXPLORATION
    
    def calculate_agent_engagement(
        self,
        agent: Dict[str, Any],
        conversation_history: List[Dict[str, Any]],
        recent_messages: List[Dict[str, Any]]
    ) -> float:
        """Рассчитать уровень вовлеченности агента в разговор"""
        agent_id = agent.get("id")
        
        # Подсчитываем участие агента
        total_messages = len(conversation_history)
        agent_messages = sum(
            1 for msg in conversation_history 
            if msg.get("agent_id") == agent_id
        )
        
        if total_messages == 0:
            return 0.5
        
        # Процент участия
        participation_rate = agent_messages / total_messages
        
        # Учитываем недавнюю активность
        recent_participation = sum(
            1 for msg in recent_messages 
            if msg.get("agent_id") == agent_id
        )
        recent_activity_bonus = min(recent_participation * 0.1, 0.3)
        
        # Бонус за молчание
        if recent_participation == 0 and len(recent_messages) >= 3:
            silence_bonus = 0.2
        else:
            silence_bonus = 0.0
        
        total_engagement = participation_rate + recent_activity_bonus + silence_bonus
        return min(total_engagement, 1.0)
    
    def update_agent_participation(self, conversation_id: int, agent_id: int):
        """Обновить счетчик участия агента"""
        if conversation_id not in self.agent_participation:
            self.agent_participation[conversation_id] = {}
        
        self.agent_participation[conversation_id][agent_id] = \
            self.agent_participation[conversation_id].get(agent_id, 0) + 1
    
    def get_agent_participation_count(self, conversation_id: int, agent_id: int) -> int:
        """Получить количество участий агента в разговоре"""
        return self.agent_participation.get(conversation_id, {}).get(agent_id, 0)
    
    def reset_conversation_participation(self, conversation_id: int):
        """Сбросить счетчики участия для разговора"""
        if conversation_id in self.agent_participation:
            del self.agent_participation[conversation_id]
        if conversation_id in self.agent_emotional_state:
            del self.agent_emotional_state[conversation_id]
        if conversation_id in self.emotional_history:
            del self.emotional_history[conversation_id]
        if conversation_id in self.emotional_inertia:
            del self.emotional_inertia[conversation_id]
