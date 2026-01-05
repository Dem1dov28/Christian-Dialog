from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from datetime import datetime
import random
import logging

from models.message import Message
from models.multi_agent_conversation import MultiAgentConversation
from services.base_service import BaseService
from services.agent_selector_service import AgentSelectorService
from services.agent_interaction_service import (
    AgentInteractionService,
    InteractionType,
    EmotionalTone,
    InteractionPattern
)
from services.agent_semantic_service import AgentSemanticService
from services.agent_role_service import AgentRoleService
from services.agent_memory_service import AgentMemoryService
from services.agent_coordination_service import AgentCoordinationService

logger = logging.getLogger(__name__)


class AgentDialogueService(BaseService):
    """Улучшенный сервис для управления диалогами между агентами с продвинутой логикой взаимодействия"""
    
    def __init__(self, agent_service, agent_selector_service: AgentSelectorService):
        super().__init__()
        self.agent_service = agent_service
        self.agent_selector = agent_selector_service
        self.interaction_service = AgentInteractionService()
        self.semantic_service = AgentSemanticService()
        self.role_service = AgentRoleService()
        self.memory_service = AgentMemoryService()
        self.coordination_service = AgentCoordinationService()
    
    async def trigger_agent_conversation(
        self, 
        conversation_id: int, 
        user_message: str, 
        agents: List[Dict[str, Any]],
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Запустить общение агентов между собой с умной логикой взаимодействия"""
        with self.get_session() as session:
            try:
                responses = []
                
                # Получаем контекст предыдущих сообщений
                conversation_context = self._get_conversation_context(session, conversation_id)
                
                # Определяем стратегию координации
                coordination_strategy = self.coordination_service.determine_strategy(
                    conversation_id, user_message, agents, conversation_context
                )
                
                # Анализируем семантику сообщения пользователя
                topic, topic_confidence = self.semantic_service.detect_topic(user_message)
                intent, intent_confidence = self.semantic_service.detect_intent(user_message)
                
                logger.debug(f"Topic: {topic} (confidence: {topic_confidence:.2f}), "
                           f"Intent: {intent} (confidence: {intent_confidence:.2f})")
                
                # Выбираем первого агента на основе релевантности
                first_agent = self.agent_selector.select_first_agent(
                    agents, 
                    user_message,
                    conversation_context
                )
                
                # Назначаем роль первому агенту
                first_agent_role = self.role_service.assign_role(
                    first_agent, conversation_id, conversation_context
                )
                
                # Получаем инструкции для роли
                role_instructions = self.role_service.get_role_instructions(
                    first_agent, first_agent_role, conversation_context
                )
                
                # Получаем контекст из памяти
                memory_context = self.memory_service.build_memory_context(
                    first_agent["id"], agents, conversation_context
                )
                
                # Строим улучшенный контекст для первого агента
                enhanced_context = f"{user_message}\n\n{role_instructions}"
                if memory_context:
                    enhanced_context += f"\n\n{memory_context}"
                
                # Генерируем ответ первого агента
                first_response = await self.agent_service.generate_response(
                    first_agent["id"], 
                    enhanced_context,
                    conversation_id=str(conversation_id),
                    is_multi_agent=True,
                    language=language
                )
                
                # Сохраняем ответ первого агента
                first_message = self._save_agent_message(
                    session, conversation_id, first_response, first_agent["id"]
                )
                
                responses.append(self._create_response_dict(
                    first_agent["id"], first_agent["name"], first_response, first_message.id
                ))
                
                # Обновляем участие агента
                self.interaction_service.update_agent_participation(conversation_id, first_agent["id"])
                
                # Анализируем тип взаимодействия и эмоциональный тон с улучшенной динамикой
                first_interaction_type = self.interaction_service.analyze_interaction_type(
                    first_response, 
                    conversation_context
                )
                raw_emotional_tone = self.interaction_service.analyze_emotional_tone(first_response)
                emotional_tone = self.interaction_service.analyze_emotional_dynamics(
                    conversation_id, first_agent["id"], raw_emotional_tone, conversation_context
                )
                
                # Записываем взаимодействие в память
                for other_agent in agents:
                    if other_agent["id"] != first_agent["id"]:
                        self.memory_service.record_interaction(
                            first_agent["id"], other_agent["id"],
                            first_interaction_type.value, first_response,
                            emotional_tone.value
                        )
                
                # Записываем тему
                self.memory_service.record_topic(first_agent["id"], topic, topic_confidence)
                
                # Выбираем отвечающих агентов с учетом координации
                responding_agents = self.agent_selector.select_responding_agents(
                    agents, 
                    first_agent,
                    user_message,
                    first_response,
                    conversation_context
                )
                
                # Сортируем агентов по приоритету с учетом координации
                for agent in responding_agents:
                    priority = self.coordination_service.calculate_agent_priority(
                        agent, conversation_id, user_message, conversation_context, coordination_strategy
                    )
                
                # Получаем очередь агентов
                agent_queue = self.coordination_service.get_agent_queue(conversation_id, responding_agents)
                
                # Обрабатываем ответы других агентов
                agent_participation = {first_agent["id"]: 1}
                
                for agent in agent_queue:
                    # Проверяем, должен ли агент ответить
                    participation_count = agent_participation.get(agent["id"], 0)
                    total_participation = self.interaction_service.get_agent_participation_count(
                        conversation_id, agent["id"]
                    )
                    
                    # Назначаем роль агенту
                    agent_role = self.role_service.assign_role(
                        agent, conversation_id, conversation_context, first_interaction_type.value
                    )
                    
                    # Проверяем, должен ли агент говорить на основе роли
                    if not self.role_service.should_agent_speak(
                        agent["id"], conversation_id, agent_role, conversation_context
                    ):
                        continue
                    
                    should_respond = self.interaction_service.should_agent_respond(
                        agent,
                        first_interaction_type,
                        conversation_context,
                        participation_count,
                        conversation_id
                    )
                    
                    if not should_respond:
                        continue
                    
                    # Определяем паттерн разговора для контекста
                    dialogue_flow = self.interaction_service.determine_dialogue_flow(responses, agents)
                    conversation_pattern = dialogue_flow.get("pattern", InteractionPattern.NEUTRAL)
                    
                    # Получаем инструкции координации
                    coordination_instructions = self.coordination_service.build_coordination_instructions(
                        coordination_strategy, agent, [a for a in agents if a["id"] != agent["id"]],
                        conversation_context
                    )
                    
                    # Получаем инструкции роли
                    role_instructions = self.role_service.get_role_instructions(
                        agent, agent_role, conversation_context
                    )
                    
                    # Получаем контекст из памяти
                    memory_context = self.memory_service.build_memory_context(
                        agent["id"], agents, conversation_context
                    )
                    
                    # Создаем улучшенный контекст для агента
                    base_context = self.interaction_service.build_context_for_agent(
                        agent,
                        user_message,
                        responses,
                        first_interaction_type,
                        conversation_pattern
                    )
                    
                    context = f"{base_context}\n\n{coordination_instructions}\n\n{role_instructions}"
                    if memory_context:
                        context += f"\n\n{memory_context}"
                    
                    # Генерируем ответ агента
                    agent_response = await self.agent_service.generate_response(
                        agent["id"], 
                        context,
                        conversation_id=str(conversation_id),
                        is_multi_agent=True,
                        language=language
                    )
                    
                    # Проверяем, не повторяет ли агент предыдущие сообщения (улучшенный семантический анализ)
                    previous_messages = [r.get("message", "") for r in responses]
                    is_repetition, max_similarity, similar_message = self.semantic_service.analyze_message_novelty(
                        agent_response,
                        previous_messages,
                        threshold=0.65  # Порог схожести
                    )
                    
                    # Если повторение, пытаемся перегенерировать с более строгими инструкциями
                    if is_repetition:
                        logger.warning(
                            f"Agent {agent['id']} ({agent['name']}) повторяет сообщение. "
                            f"Схожесть с: {similar_message[:50]}..."
                        )
                        # Добавляем более строгое предупреждение в контекст
                        strict_context = context + (
                            f"\n\n⚠️ ВНИМАНИЕ: Твой предыдущий ответ был слишком похож на: "
                            f'"{similar_message[:100]}..."\n'
                            "Дай ПОЛНОСТЬЮ НОВЫЙ ответ, используя другие слова и формулировки. "
                            "Вырази ту же мысль, но по-другому, или добавь что-то принципиально новое."
                        )
                        
                        # Перегенерируем ответ
                        agent_response = await self.agent_service.generate_response(
                            agent["id"], 
                            strict_context,
                            conversation_id=str(conversation_id),
                            is_multi_agent=True,
                            language=language
                        )
                        
                        # Проверяем еще раз
                        is_still_repetition, _, _ = self.semantic_service.analyze_message_novelty(
                            agent_response,
                            previous_messages,
                            threshold=0.6
                        )
                        
                        if is_still_repetition:
                            logger.warning(
                                f"Agent {agent['id']} все еще повторяется после перегенерации. "
                                "Пропускаем ответ."
                            )
                            continue  # Пропускаем этого агента, если все еще повторяется
                    
                    # Сохраняем ответ агента
                    agent_message = self._save_agent_message(
                        session, conversation_id, agent_response, agent["id"]
                    )
                    
                    responses.append(self._create_response_dict(
                        agent["id"], agent["name"], agent_response, agent_message.id
                    ))
                    
                    agent_participation[agent["id"]] = agent_participation.get(agent["id"], 0) + 1
                    self.interaction_service.update_agent_participation(conversation_id, agent["id"])
                
                # Определяем, нужно ли продолжать диалог
                dialogue_flow = self.interaction_service.determine_dialogue_flow(responses, agents)
                should_continue = self.agent_selector.should_continue_dialogue(
                    agents,
                    responses,
                    conversation_context
                ) and dialogue_flow["should_continue"]
                
                if should_continue and len(responses) > 0:
                    await self._continue_agent_dialogue(
                        session, 
                        conversation_id, 
                        user_message, 
                        agents,
                        responses, 
                        dialogue_flow,
                        language
                    )
                
                logger.info(f"Triggered agent conversation {conversation_id} with {len(responses)} responses")
                
                return {
                    "conversation_id": conversation_id,
                    "user_message": user_message,
                    "agent_responses": responses
                }
            except Exception as e:
                logger.error(f"Error in trigger_agent_conversation: {e}", exc_info=True)
                raise
    
    async def _continue_agent_dialogue(
        self, 
        session: Session,
        conversation_id: int, 
        user_message: str,
        agents: List[Dict[str, Any]],
        responses: List[Dict[str, Any]],
        dialogue_flow: Dict[str, Any],
        language: Optional[str] = None
    ) -> None:
        """Продолжить диалог между агентами"""
        try:
            # Определяем приоритетных агентов для ответа
            priority_agents = dialogue_flow.get("priority_agents", [])
            if not priority_agents:
                # Если нет приоритетных, выбираем из всех, исключая последних говорящих
                last_agent_id = responses[-1].get("agent_id") if responses else None
                available_agents = [a for a in agents if a["id"] != last_agent_id]
                priority_agents = available_agents if available_agents else agents
            
            # Получаем контекст для умного выбора
            conversation_context = self._get_conversation_context(session, conversation_id)
            recent_messages = [
                {"agent_id": r.get("agent_id"), "content": r.get("message"), "agent_name": r.get("agent_name")}
                for r in responses[-3:]
            ]
            
            # Выбираем следующего агента с учетом контекста
            last_agent_id = responses[-1].get("agent_id") if responses else None
            next_agent = self.agent_selector.select_next_agent_for_continuation(
                priority_agents if priority_agents else agents,
                last_agent_id,
                conversation_context,
                recent_messages
            )
            
            # Определяем тип взаимодействия и паттерн для контекста
            next_interaction_type = dialogue_flow.get("next_interaction_type", InteractionType.NEUTRAL)
            conversation_pattern = dialogue_flow.get("pattern", InteractionPattern.NEUTRAL)
            
            # Создаем контекст для агента
            context = self.interaction_service.build_context_for_agent(
                next_agent,
                user_message,
                responses,
                next_interaction_type,
                conversation_pattern
            )
            
            # Агент продолжает диалог
            continuation_response = await self.agent_service.generate_response(
                next_agent["id"], 
                context,
                conversation_id=str(conversation_id),
                is_multi_agent=True,
                language=language
            )
            
            # Проверяем на повторения (улучшенный семантический анализ)
            previous_messages = [r.get("message", "") for r in responses]
            is_repetition, _, similar_message = self.semantic_service.analyze_message_novelty(
                continuation_response,
                previous_messages,
                threshold=0.65
            )
            
            if is_repetition:
                logger.warning(
                    f"Agent {next_agent['id']} ({next_agent['name']}) повторяет в продолжении диалога. "
                    f"Схожесть с: {similar_message[:50]}..."
                )
                # Перегенерируем с более строгими инструкциями
                strict_context = context + (
                    f"\n\n⚠️ ВНИМАНИЕ: Твой ответ слишком похож на предыдущие сообщения. "
                    "Дай ПОЛНОСТЬЮ НОВЫЙ ответ, используя другие слова и формулировки."
                )
                continuation_response = await self.agent_service.generate_response(
                    next_agent["id"], 
                    strict_context,
                    conversation_id=str(conversation_id),
                    is_multi_agent=True,
                    language=language
                )
            
            # Сохраняем продолжение диалога
            continuation_message = self._save_agent_message(
                session, conversation_id, continuation_response, next_agent["id"]
            )
            
            responses.append(self._create_response_dict(
                next_agent["id"], next_agent["name"], continuation_response, continuation_message.id
            ))
            
            self.interaction_service.update_agent_participation(conversation_id, next_agent["id"])
            
            # Анализируем, нужно ли добавить финальный ответ
            continuation_interaction = self.interaction_service.analyze_interaction_type(
                continuation_response,
                responses
            )
            
            # Вероятность финального ответа зависит от типа взаимодействия
            final_probability = 0.3
            if continuation_interaction in [InteractionType.QUESTION, InteractionType.DISAGREEMENT]:
                final_probability = 0.5
            
            if self.agent_selector.should_add_final_response(final_probability):
                other_agents = [a for a in agents if a["id"] != next_agent["id"]]
                if other_agents:
                    # Выбираем агента с учетом вовлеченности
                    agent_engagements = []
                    for agent in other_agents:
                        engagement = self.interaction_service.calculate_agent_engagement(
                            agent,
                            conversation_context,
                            recent_messages
                        )
                        agent_engagements.append((agent, engagement))
                    
                    # Сортируем по вовлеченности и выбираем
                    agent_engagements.sort(key=lambda x: x[1], reverse=True)
                    final_agent = agent_engagements[0][0] if agent_engagements else random.choice(other_agents)
                    
                    dialogue_context = f"Пользователь: {user_message}\n"
                    for response_data in responses:
                        dialogue_context += f"{response_data['agent_name']}: {response_data['message']}\n"
                    
                    final_context = f"{dialogue_context}{next_agent['name']}: {continuation_response}"
                    final_response = await self.agent_service.generate_response(
                        final_agent["id"], 
                        f"Продолжи диалог естественно. Контекст:\n{final_context}\n\n"
                        "ВАЖНО: НЕ ПОВТОРЯЙ дословно то, что уже сказали другие. Выражай свои мысли оригинально.",
                        conversation_id=str(conversation_id),
                        is_multi_agent=True,
                        language=language
                    )
                    
                    # Проверяем финальный ответ на повторения (улучшенный семантический анализ)
                    all_previous = [r.get("message", "") for r in responses]
                    is_final_repetition, _, _ = self.semantic_service.analyze_message_novelty(
                        final_response,
                        all_previous,
                        threshold=0.65
                    )
                    
                    if not is_final_repetition:  # Сохраняем только если не повторение
                        self._save_agent_message(session, conversation_id, final_response, final_agent["id"])
                        self.interaction_service.update_agent_participation(conversation_id, final_agent["id"])
                    else:
                        logger.warning(
                            f"Финальный ответ агента {final_agent['id']} был пропущен из-за повторения."
                        )
        except Exception as e:
            logger.error(f"Error in _continue_agent_dialogue: {e}", exc_info=True)
            raise
    
    async def continue_dialogue(self, conversation_id: int, agents: List[Dict[str, Any]], language: Optional[str] = None, is_chat_active: bool = False) -> Dict[str, Any]:
        """Продолжить диалог между агентами без участия пользователя
        
        Args:
            conversation_id: ID разговора
            agents: Список агентов
            language: Язык для ответа
            is_chat_active: Если True, чат активен и счетчик не увеличивается
        """
        with self.get_session() as db_session:
            try:
                if len(agents) < 2:
                    raise ValueError("Need at least 2 agents to continue dialogue")
                
                # Получаем последние сообщения для контекста
                recent_messages = db_session.exec(
                    select(Message)
                    .where(Message.multi_agent_conversation_id == conversation_id)
                    .order_by(Message.created_at.desc())
                    .limit(5)
                ).all()
                
                if not recent_messages:
                    raise ValueError("No messages found in conversation")
                
                # Определяем последних говорящих агентов
                last_message = recent_messages[0]
                last_agent_id = last_message.agent_id if not last_message.is_from_user else None
                
                second_last_agent_id = None
                if len(recent_messages) >= 2:
                    second_last_message = recent_messages[1]
                    second_last_agent_id = second_last_message.agent_id if not second_last_message.is_from_user else None
                
                # Преобразуем сообщения в формат для анализа
                recent_messages_dict = [
                    {
                        "agent_id": msg.agent_id if not msg.is_from_user else None,
                        "content": msg.content,
                        "agent_name": msg.agent.name if msg.agent and not msg.is_from_user else "Пользователь"
                    }
                    for msg in reversed(recent_messages)
                ]
                
                # Получаем контекст разговора
                conversation_context = self._get_conversation_context(db_session, conversation_id)
                
                # Определяем стратегию координации (если еще не определена)
                if conversation_id not in self.coordination_service.conversation_strategies:
                    # Анализируем последние сообщения для определения стратегии
                    # Используем recent_messages_dict, так как recent_messages содержит объекты Message
                    last_message_text = recent_messages_dict[-1].get("content", "") if recent_messages_dict else ""
                    self.coordination_service.determine_strategy(
                        conversation_id, last_message_text, agents, conversation_context
                    )
                
                coordination_strategy = self.coordination_service.get_strategy(conversation_id)
                
                # Выбираем агента с учетом контекста и релевантности
                agent = self.agent_selector.select_agent_with_priority(
                    agents, 
                    last_agent_id, 
                    second_last_agent_id,
                    conversation_context,
                    recent_messages_dict
                )
                
                # Назначаем роль агенту
                agent_role = self.role_service.assign_role(
                    agent, conversation_id, conversation_context
                )
                
                # Получаем инструкции роли
                role_instructions = self.role_service.get_role_instructions(
                    agent, agent_role, conversation_context
                )
                
                # Получаем контекст из памяти
                memory_context = self.memory_service.build_memory_context(
                    agent["id"], agents, conversation_context
                )
                
                # Получаем инструкции координации
                coordination_instructions = self.coordination_service.build_coordination_instructions(
                    coordination_strategy, agent, [a for a in agents if a["id"] != agent["id"]],
                    conversation_context
                )
                
                # Создаем улучшенный контекст из последних сообщений
                base_context = self._build_dialogue_context(recent_messages, agent["name"])
                context = f"{base_context}\n\n{role_instructions}\n\n{coordination_instructions}"
                if memory_context:
                    context += f"\n\n{memory_context}"
                
                # Агент продолжает диалог
                # Используем is_multi_agent=True для уникального conversation_id
                continuation_response = await self.agent_service.generate_response(
                    agent["id"], 
                    f"Продолжи диалог естественно, основываясь на контексте:\n{context}",
                    conversation_id=str(conversation_id),
                    is_multi_agent=True,
                    language=language  # Передаем язык для ответа агента
                )
                
                # Проверяем на повторения (улучшенный семантический анализ)
                previous_contents = [msg.content for msg in recent_messages if not msg.is_from_user]
                is_repetition, _, similar_message = self.semantic_service.analyze_message_novelty(
                    continuation_response,
                    previous_contents,
                    threshold=0.65
                )
                
                if is_repetition:
                    logger.warning(
                        f"Agent {agent['id']} ({agent['name']}) повторяет в continue_dialogue. "
                        f"Схожесть с: {similar_message[:50]}..."
                    )
                    # Перегенерируем
                    strict_context = context + (
                        "\n\n⚠️ ВНИМАНИЕ: Твой ответ слишком похож на предыдущие сообщения. "
                        "Дай ПОЛНОСТЬЮ НОВЫЙ ответ, используя другие слова и формулировки."
                    )
                    continuation_response = await self.agent_service.generate_response(
                        agent["id"], 
                        strict_context,
                        conversation_id=str(conversation_id),
                        is_multi_agent=True,
                        language=language
                    )
                
                # Сохраняем продолжение диалога
                continuation_message = self._save_agent_message(
                    db_session, conversation_id, continuation_response, agent["id"], is_chat_active=is_chat_active
                )
                
                responses = [self._create_response_dict(
                    agent["id"], agent["name"], continuation_response, continuation_message.id
                )]
                
                # С вероятностью 40% может ответить еще один агент
                if self.agent_selector.should_add_final_response(0.4):
                    other_agents = [a for a in agents if a["id"] != agent["id"]]
                    if other_agents:
                        final_agent = random.choice(other_agents)
                        final_context = f"{context}\n{agent['name']}: {continuation_response}"
                        # Используем is_multi_agent=True для уникального conversation_id
                        final_response = await self.agent_service.generate_response(
                            final_agent["id"], 
                            f"Продолжи диалог естественно. Контекст:\n{final_context}\n\n"
                            "ВАЖНО: НЕ ПОВТОРЯЙ дословно то, что уже сказали другие. Выражай свои мысли оригинально.",
                            conversation_id=str(conversation_id),
                            is_multi_agent=True,
                            language=language  # Передаем язык для ответа агента
                        )
                        
                        # Проверяем финальный ответ на повторения (улучшенный семантический анализ)
                        all_previous = previous_contents + [continuation_response]
                        is_final_repetition, _, _ = self.semantic_service.analyze_message_novelty(
                            final_response,
                            all_previous,
                            threshold=0.65
                        )
                        
                        if not is_final_repetition:  # Сохраняем только если не повторение
                            final_message = self._save_agent_message(
                                db_session, conversation_id, final_response, final_agent["id"], is_chat_active=is_chat_active
                            )
                            
                            responses.append(self._create_response_dict(
                                final_agent["id"], final_agent["name"], final_response, final_message.id
                            ))
                        else:
                            logger.warning(
                                f"Финальный ответ агента {final_agent['id']} был пропущен из-за повторения."
                            )
                
                logger.info(f"Continued dialogue {conversation_id} with {len(responses)} responses")
                
                return {
                    "conversation_id": conversation_id,
                    "agent_responses": responses
                }
            except Exception as e:
                logger.error(f"Error in continue_dialogue: {e}", exc_info=True)
                raise
    
    def _save_agent_message(self, session: Session, conversation_id: int, content: str, agent_id: int, is_chat_active: bool = False) -> Message:
        """Сохранить сообщение агента
        
        Args:
            session: Сессия базы данных
            conversation_id: ID разговора
            content: Содержимое сообщения
            agent_id: ID агента
            is_chat_active: Если True, чат активен и счетчик не увеличивается
        """
        try:
            message = Message(
                multi_agent_conversation_id=conversation_id,
                content=content,
                is_from_user=False,
                agent_id=agent_id
            )
            session.add(message)
            
            # Обновляем время последнего обновления группового чата
            multi_conversation = session.get(MultiAgentConversation, conversation_id)
            if multi_conversation:
                multi_conversation.updated_at = datetime.utcnow()
                # 📬 Увеличиваем счетчик непрочитанных только если чат НЕ активен
                if not is_chat_active:
                    multi_conversation.unread_count = (multi_conversation.unread_count or 0) + 1
                    logger.debug(f"📬 [UNREAD] Увеличен счетчик для мульти-агентного чата {conversation_id}: {multi_conversation.unread_count} (чат не активен)")
                else:
                    logger.debug(f"📬 [UNREAD] Чат {conversation_id} активен, счетчик не увеличивается")
            
            session.commit()
            session.refresh(message)
            return message
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving agent message: {e}", exc_info=True)
            raise
    
    def _build_dialogue_context(self, recent_messages: List[Message], agent_name: str) -> str:
        """Построить контекст диалога из последних сообщений"""
        context = "Последние сообщения в чате (НЕ ПОВТОРЯЙ эти мысли дословно):\n"
        for msg in reversed(recent_messages):
            if msg.is_from_user:
                sender = "Пользователь"
            else:
                # Безопасно получаем имя агента
                try:
                    sender = msg.agent.name if msg.agent else "Агент"
                except AttributeError:
                    sender = "Агент"
            context += f"- {sender}: {msg.content}\n"
        
        context += (
            f"\nТеперь отвечает {agent_name}. "
            "ВАЖНО: Продолжи диалог естественно, но НЕ ПОВТОРЯЙ дословно то, что уже сказали другие. "
            "Выражай свои мысли оригинально, даже если согласен с предыдущими высказываниями."
        )
        return context
    
    def _build_initial_context(self, user_message: str, first_agent: Dict[str, Any], first_response: str) -> str:
        """Построить начальный контекст диалога"""
        return f"Пользователь: {user_message}\n{first_agent['name']}: {first_response}"
    
    def _get_conversation_context(
        self, 
        session: Session, 
        conversation_id: int, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Получить контекст разговора для анализа
        
        Args:
            session: Сессия базы данных
            conversation_id: ID разговора
            limit: Количество последних сообщений для контекста
            
        Returns:
            Список сообщений в формате для анализа
        """
        try:
            messages = session.exec(
                select(Message)
                .where(Message.multi_agent_conversation_id == conversation_id)
                .where(Message.is_deleted == False)
                .order_by(Message.created_at.desc())
                .limit(limit)
            ).all()
            
            context = []
            for msg in reversed(messages):
                context.append({
                    "agent_id": msg.agent_id if not msg.is_from_user else None,
                    "content": msg.content,
                    "is_from_user": msg.is_from_user,
                    "agent_name": msg.agent.name if msg.agent and not msg.is_from_user else "Пользователь"
                })
            
            return context
        except Exception as e:
            logger.warning(f"Error getting conversation context: {e}")
            return []
    
    def _create_response_dict(self, agent_id: int, agent_name: str, message: str, message_id: int) -> Dict[str, Any]:
        """Создать словарь ответа агента"""
        return {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "message": message,
            "message_id": message_id
        }
    
