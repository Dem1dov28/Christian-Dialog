from typing import List, Dict, Any, Optional, Tuple
import logging
import re
from collections import Counter
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class AgentSemanticService:
    """Улучшенный сервис для семантического анализа взаимодействий агентов"""
    
    def __init__(self):
        # Ключевые слова для определения тем
        self.topic_keywords = {
            "технологии": ["код", "программирование", "алгоритм", "api", "база данных", 
                          "фреймворк", "библиотека", "разработка", "технология"],
            "бизнес": ["стратегия", "маркетинг", "продажи", "прибыль", "клиент", 
                      "конкуренция", "рынок", "бизнес-модель"],
            "наука": ["исследование", "эксперимент", "теория", "гипотеза", "анализ", 
                     "данные", "методология"],
            "творчество": ["идея", "дизайн", "художественный", "креативный", "воображение", 
                          "вдохновение", "проект"],
            "образование": ["обучение", "урок", "объяснить", "преподавать", "учить", 
                           "знания", "навыки"],
        }
        
        # Паттерны для определения намерений
        self.intent_patterns = {
            "запрос_мнения": [r"что.*думаешь", r"твоё.*мнение", r"как.*считаешь", 
                             r"what.*think", r"your.*opinion"],
            "запрос_совета": [r"посоветуй", r"что.*делать", r"как.*лучше", 
                             r"advice", r"recommend", r"suggest"],
            "запрос_информации": [r"расскажи", r"объясни", r"что.*такое", 
                                  r"tell.*about", r"explain", r"what.*is"],
            "предложение": [r"предлагаю", r"можно.*сделать", r"давай", 
                           r"suggest", r"let.*s", r"we.*could"],
            "критика": [r"проблема", r"недостаток", r"слабость", r"не.*работает",
                       r"problem", r"issue", r"weakness", r"doesn.*t.*work"],
        }
    
    def analyze_semantic_similarity(
        self,
        text1: str,
        text2: str,
        method: str = "hybrid"
    ) -> float:
        """Анализировать семантическую схожесть двух текстов
        
        Args:
            text1: Первый текст
            text2: Второй текст
            method: Метод анализа ('jaccard', 'sequence', 'hybrid')
            
        Returns:
            Оценка схожести от 0.0 до 1.0
        """
        if not text1 or not text2:
            return 0.0
        
        text1_lower = text1.lower().strip()
        text2_lower = text2.lower().strip()
        
        if method == "jaccard":
            return self._jaccard_similarity(text1_lower, text2_lower)
        elif method == "sequence":
            return self._sequence_similarity(text1_lower, text2_lower)
        elif method == "hybrid":
            # Комбинированный подход
            jaccard = self._jaccard_similarity(text1_lower, text2_lower)
            sequence = self._sequence_similarity(text1_lower, text2_lower)
            # Взвешенное среднее
            return (jaccard * 0.4 + sequence * 0.6)
        
        return 0.0
    
    def _jaccard_similarity(self, text1: str, text2: str) -> float:
        """Коэффициент Жаккара для множеств слов"""
        words1 = set(self._extract_significant_words(text1))
        words2 = set(self._extract_significant_words(text2))
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        if not union:
            return 0.0
        
        return len(intersection) / len(union)
    
    def _sequence_similarity(self, text1: str, text2: str) -> float:
        """Схожесть последовательностей с помощью SequenceMatcher"""
        return SequenceMatcher(None, text1, text2).ratio()
    
    def _extract_significant_words(self, text: str, min_length: int = 3) -> List[str]:
        """Извлечь значимые слова из текста"""
        # Удаляем пунктуацию и разбиваем на слова
        words = re.findall(r'\b\w+\b', text.lower())
        # Фильтруем короткие слова и стоп-слова
        stop_words = {"и", "в", "на", "с", "по", "для", "от", "до", "из", "к", 
                     "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for"}
        return [w for w in words if len(w) >= min_length and w not in stop_words]
    
    def detect_topic(self, text: str) -> Tuple[str, float]:
        """Определить тему текста
        
        Returns:
            Tuple[тема, уверенность] где уверенность от 0.0 до 1.0
        """
        text_lower = text.lower()
        topic_scores = {}
        
        for topic, keywords in self.topic_keywords.items():
            matches = sum(1 for keyword in keywords if keyword in text_lower)
            if matches > 0:
                # Нормализуем по количеству ключевых слов в теме
                score = matches / len(keywords)
                topic_scores[topic] = score
        
        if not topic_scores:
            return ("общее", 0.0)
        
        best_topic = max(topic_scores.items(), key=lambda x: x[1])
        return best_topic
    
    def detect_intent(self, text: str) -> Tuple[str, float]:
        """Определить намерение в тексте
        
        Returns:
            Tuple[намерение, уверенность]
        """
        text_lower = text.lower()
        intent_scores = {}
        
        for intent, patterns in self.intent_patterns.items():
            matches = sum(1 for pattern in patterns if re.search(pattern, text_lower))
            if matches > 0:
                score = matches / len(patterns)
                intent_scores[intent] = score
        
        if not intent_scores:
            return ("нейтральное", 0.0)
        
        best_intent = max(intent_scores.items(), key=lambda x: x[1])
        return best_intent
    
    def extract_key_concepts(self, text: str, max_concepts: int = 5) -> List[str]:
        """Извлечь ключевые концепции из текста"""
        words = self._extract_significant_words(text, min_length=4)
        
        # Подсчитываем частоту слов
        word_freq = Counter(words)
        
        # Берем наиболее частые слова как ключевые концепции
        most_common = word_freq.most_common(max_concepts)
        return [word for word, count in most_common if count >= 2]
    
    def analyze_message_novelty(
        self,
        new_message: str,
        previous_messages: List[str],
        threshold: float = 0.55  # Lowered from 0.65 for stricter detection
    ) -> Tuple[bool, float, Optional[str]]:
        """Анализировать новизну сообщения относительно предыдущих
        
        Args:
            new_message: Новое сообщение
            previous_messages: Список предыдущих сообщений
            threshold: Порог схожести для определения повторения
            
        Returns:
            Tuple[is_repetition, max_similarity, most_similar_message]
        """
        if not previous_messages:
            return (False, 0.0, None)
        
        max_similarity = 0.0
        most_similar = None
        
        for prev_msg in previous_messages:
            # Use enhanced similarity with n-gram analysis
            similarity = self._calculate_enhanced_similarity(new_message, prev_msg)
            
            if similarity > max_similarity:
                max_similarity = similarity
                most_similar = prev_msg
        
        is_repetition = max_similarity >= threshold
        return (is_repetition, max_similarity, most_similar)
    
    def _calculate_enhanced_similarity(self, text1: str, text2: str) -> float:
        """Calculate enhanced similarity with n-gram phrase detection
        
        This detects when the same ideas are expressed using similar phrases,
        even with different wordings.
        """
        # Base semantic similarity
        base_similarity = self.analyze_semantic_similarity(text1, text2, method="hybrid")
        
        # N-gram analysis for phrase-level similarity
        text1_lower = text1.lower().strip()
        text2_lower = text2.lower().strip()
        
        # Extract n-grams (3-5 word phrases)
        ngrams1 = self._extract_ngrams(text1_lower, n=3)
        ngrams2 = self._extract_ngrams(text2_lower, n=3)
        
        if ngrams1 and ngrams2:
            # Calculate Jaccard similarity for n-grams
            intersection = len(ngrams1.intersection(ngrams2))
            union = len(ngrams1.union(ngrams2))
            ngram_similarity = intersection / union if union > 0 else 0.0
            
            # Boost similarity if there are common phrases
            if intersection >= 2:  # At least 2 common 3-word phrases
                phrase_boost = min(intersection * 0.15, 0.3)
                base_similarity = min(base_similarity + phrase_boost, 1.0)
        
        # Key concept overlap analysis
        concepts1 = set(self._extract_significant_words(text1))
        concepts2 = set(self._extract_significant_words(text2))
        
        if concepts1 and concepts2:
            concept_overlap = len(concepts1.intersection(concepts2))
            total_concepts = len(concepts1.union(concepts2))
            
            # If high concept overlap, increase similarity
            if total_concepts > 0:
                concept_ratio = concept_overlap / total_concepts
                if concept_ratio > 0.7:  # More than 70% concept overlap
                    base_similarity = min(base_similarity + 0.1, 1.0)
        
        return base_similarity
    
    def _extract_ngrams(self, text: str, n: int = 3) -> set:
        """Extract n-grams (n-word phrases) from text"""
        words = re.findall(r'\b\w+\b', text.lower())
        
        # Filter out stop words for cleaner n-grams
        stop_words = {"и", "в", "на", "с", "по", "для", "от", "до", "из", "к", 
                     "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                     "это", "что", "как", "не", "но", "то", "так", "же", "бы", "быть"}
        
        filtered_words = [w for w in words if w not in stop_words]
        
        if len(filtered_words) < n:
            return set()
        
        ngrams = set()
        for i in range(len(filtered_words) - n + 1):
            ngram = " ".join(filtered_words[i:i+n])
            ngrams.add(ngram)
        
        return ngrams
    
    def analyze_message_novelty_enhanced(
        self,
        new_message: str,
        previous_messages: List[str],
        agent_own_messages: List[str],  # Agent's own previous messages
        threshold: float = 0.55
    ) -> Tuple[bool, float, Optional[str], bool]:
        """Enhanced novelty analysis that also checks agent's own message history
        
        Returns:
            Tuple[is_repetition, max_similarity, most_similar_message, is_self_repetition]
        """
        # Check against all previous messages
        is_repetition, max_similarity, most_similar = self.analyze_message_novelty(
            new_message, previous_messages, threshold
        )
        
        # Also check against agent's own messages (stricter threshold for self-repetition)
        self_threshold = threshold * 0.9  # 10% stricter for self-repetition
        is_self_repetition = False
        
        if agent_own_messages:
            is_self_rep, self_sim, self_similar = self.analyze_message_novelty(
                new_message, agent_own_messages, self_threshold
            )
            if is_self_rep and self_sim > max_similarity:
                is_self_repetition = True
                max_similarity = self_sim
                most_similar = self_similar
                is_repetition = True
        
        return (is_repetition, max_similarity, most_similar, is_self_repetition)
    
    def find_semantic_gaps(
        self,
        messages: List[Dict[str, Any]],
        agents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Найти семантические пробелы в разговоре
        
        Анализирует, какие аспекты темы не были затронуты
        
        Returns:
            Список словарей с информацией о пробелах
        """
        if not messages:
            return []
        
        # Извлекаем все ключевые концепции из сообщений
        all_concepts = []
        for msg in messages:
            content = msg.get("message", "") or msg.get("content", "")
            concepts = self.extract_key_concepts(content)
            all_concepts.extend(concepts)
        
        # Находим уникальные концепции
        unique_concepts = list(set(all_concepts))
        
        # Определяем тему разговора
        full_text = " ".join([msg.get("message", "") or msg.get("content", "") 
                             for msg in messages])
        topic, confidence = self.detect_topic(full_text)
        
        gaps = []
        
        # Проверяем, какие агенты могут заполнить пробелы
        for agent in agents:
            agent_category = agent.get("category", "").lower()
            agent_description = agent.get("description", "").lower()
            
            # Проверяем релевантность агента к теме
            if topic in self.topic_keywords:
                topic_keywords = self.topic_keywords[topic]
                relevance = sum(1 for kw in topic_keywords 
                              if kw in agent_description or kw in agent_category)
                
                if relevance > 0:
                    gaps.append({
                        "agent_id": agent.get("id"),
                        "agent_name": agent.get("name"),
                        "topic": topic,
                        "relevance": relevance / len(topic_keywords),
                        "suggested_contribution": f"Может добавить перспективу по теме '{topic}'"
                    })
        
        return gaps
    
    def calculate_conversation_coherence(
        self,
        messages: List[Dict[str, Any]]
    ) -> float:
        """Рассчитать когерентность разговора
        
        Returns:
            Оценка когерентности от 0.0 до 1.0
        """
        if len(messages) < 2:
            return 1.0
        
        # Извлекаем темы из каждого сообщения
        topics = []
        for msg in messages:
            content = msg.get("message", "") or msg.get("content", "")
            topic, _ = self.detect_topic(content)
            topics.append(topic)
        
        # Когерентность = доля сообщений с одинаковой темой
        if not topics:
            return 0.0
        
        most_common_topic_count = Counter(topics).most_common(1)[0][1]
        coherence = most_common_topic_count / len(topics)
        
        return coherence


















