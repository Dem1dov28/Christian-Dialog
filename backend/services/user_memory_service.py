"""Сервис умной памяти агента о пользователе.

Хранит важные факты (биография, манера общения, философия, интересы и т.д.)
и добавляет их в контекст для более натурального диалога.
"""

from typing import List, Optional
from datetime import datetime
import logging
import asyncio

from sqlmodel import Session, select
from models.user_memory import UserMemory, USER_MEMORY_TYPES
from services.base_service import BaseService

logger = logging.getLogger(__name__)

# Промпт для извлечения фактов из диалога
EXTRACTION_PROMPT = """Извлеки из следующего диалога ВАЖНЫЕ факты о пользователе, которые стоит запомнить для персонализации будущих ответов.

Категории фактов:
- bio: биографические (имя, возраст, профессия, семья, место жительства)
- communication: манера общения (формальность, юмор, предпочитаемый тон)
- philosophy: философские взгляды, ценности, убеждения
- interests: интересы, хобби, увлечения
- preferences: предпочтения (любимое/нелюбимое в разных сферах)
- other: прочее важное

Диалог:
{dialogue}

Правила:
1. Извлекай только факты, явно указанные или однозначно выводимые
2. Не выдумывай и не интерпретируй избыточно
3. Каждый факт — одна короткая фраза (до 100 символов)
4. Ответь СТРОГО в формате JSON-массива, без пояснений:
[{{"type": "bio", "content": "факт", "importance": 0.8}}, ...]
importance от 0 до 1 (0.8+ — очень важно, 0.5 — средне, 0.3 — справочно)
5. Если фактов нет — ответь: []
"""


class UserMemoryService(BaseService):
    """Сервис памяти о пользователе для персонализации ответов агента."""

    MAX_MEMORIES_PER_AGENT = 50  # Макс. фактов на пару user+agent
    MAX_CONTEXT_MEMORIES = 15    # Сколько фактов добавлять в промпт
    MIN_IMPORTANCE = 0.2         # Минимальная важность для контекста

    def add_memory(
        self,
        user_id: int,
        agent_id: int,
        memory_type: str,
        content: str,
        importance: float = 0.5,
        source_message_id: Optional[int] = None,
    ) -> Optional[UserMemory]:
        """Добавить факт в память (с дедупликацией по content)."""
        content = (content or "").strip()
        if not content:
            return None

        if memory_type not in USER_MEMORY_TYPES:
            memory_type = "other"

        try:
            with self.get_session() as session:
                # Дедупликация: не добавляем, если такой факт уже есть
                existing = session.exec(
                    select(UserMemory).where(
                        UserMemory.user_id == user_id,
                        UserMemory.agent_id == agent_id,
                        UserMemory.content == content,
                    )
                ).first()
                if existing:
                    # Обновляем важность и дату при повторном упоминании
                    existing.importance = max(existing.importance, importance)
                    existing.updated_at = datetime.utcnow()
                    session.add(existing)
                    session.commit()
                    session.refresh(existing)
                    return existing

                mem = UserMemory(
                    user_id=user_id,
                    agent_id=agent_id,
                    memory_type=memory_type,
                    content=content,
                    importance=min(1.0, max(0.0, importance)),
                    source_message_id=source_message_id,
                )
                session.add(mem)
                session.commit()
                session.refresh(mem)

                # Ограничиваем размер памяти
                self._trim_memories(session, user_id, agent_id)
                return mem
        except Exception as e:
            logger.error(f"Ошибка добавления памяти: {e}", exc_info=True)
            return None

    def _trim_memories(self, session: Session, user_id: int, agent_id: int) -> None:
        """Оставить не более MAX_MEMORIES_PER_AGENT самых важных и свежих."""
        memories = session.exec(
            select(UserMemory)
            .where(
                UserMemory.user_id == user_id,
                UserMemory.agent_id == agent_id,
            )
            .order_by(UserMemory.importance.desc(), UserMemory.updated_at.desc())
        ).all()

        if len(memories) <= self.MAX_MEMORIES_PER_AGENT:
            return

        to_delete = memories[self.MAX_MEMORIES_PER_AGENT:]
        for m in to_delete:
            session.delete(m)
        session.commit()

    def get_memories_for_context(
        self,
        user_id: int,
        agent_id: int,
        limit: Optional[int] = None,
        min_importance: Optional[float] = None,
    ) -> str:
        """Получить отформатированный контекст памяти для промпта."""
        limit = limit or self.MAX_CONTEXT_MEMORIES
        min_importance = min_importance if min_importance is not None else self.MIN_IMPORTANCE

        try:
            with self.get_session() as session:
                memories = session.exec(
                    select(UserMemory)
                    .where(
                        UserMemory.user_id == user_id,
                        UserMemory.agent_id == agent_id,
                        UserMemory.importance >= min_importance,
                    )
                    .order_by(UserMemory.importance.desc(), UserMemory.updated_at.desc())
                    .limit(limit)
                ).all()

                if not memories:
                    return ""

                # Группируем по типу для читаемости
                by_type = {
                    "bio": "О пользователе",
                    "communication": "Манера общения",
                    "philosophy": "Взгляды и ценности",
                    "interests": "Интересы",
                    "preferences": "Предпочтения",
                    "other": "Прочее",
                }
                lines = ["\n[Что ты знаешь о пользователе — учитывай в ответе:]"]
                for m in memories:
                    label = by_type.get(m.memory_type, m.memory_type)
                    lines.append(f"- [{label}] {m.content}")
                return "\n".join(lines)
        except Exception as e:
            logger.error(f"Ошибка получения памяти: {e}", exc_info=True)
            return ""

    async def extract_and_save_memories_async(
        self,
        user_id: int,
        agent_id: int,
        user_message: str,
        agent_response: str,
        message_id: Optional[int] = None,
        langchain_service=None,
    ) -> int:
        """
        Извлечь факты из обмена сообщениями через LLM и сохранить (async).
        Возвращает количество добавленных фактов.
        """
        if not user_message and not agent_response:
            return 0

        dialogue = f"Пользователь: {user_message}\n\nОтвет: {agent_response}"
        if len(dialogue) > 2000:
            dialogue = dialogue[:2000] + "..."

        if not langchain_service:
            try:
                from services.langchain_service import LangChainService
                langchain_service = LangChainService()
            except ImportError:
                logger.warning("LangChainService недоступен для извлечения памяти")
                return 0

        try:
            import json

            prompt = EXTRACTION_PROMPT.format(dialogue=dialogue)

            response_text = await langchain_service.generate_response(
                agent_name="Memory Extractor",
                instructions="Ты извлекаешь факты о пользователе. Отвечай только валидным JSON-массивом.",
                user_message=prompt,
                conversation_id=None,
                model=None,
            )

            if not response_text or not isinstance(response_text, str):
                return 0

            # Очищаем от markdown и лишнего
            text = response_text.strip()
            for prefix in ("```json", "```"):
                if text.startswith(prefix):
                    text = text[len(prefix):].strip()
                if text.endswith("```"):
                    text = text[:-3].strip()

            # Парсим JSON
            items = json.loads(text)
            if not isinstance(items, list):
                return 0

            added = 0
            for item in items:
                if not isinstance(item, dict):
                    continue
                content = item.get("content", "").strip()
                if not content:
                    continue
                mem_type = item.get("type", "other")
                if mem_type not in USER_MEMORY_TYPES:
                    mem_type = "other"
                importance = float(item.get("importance", 0.5))
                importance = min(1.0, max(0.0, importance))

                if self.add_memory(
                    user_id=user_id,
                    agent_id=agent_id,
                    memory_type=mem_type,
                    content=content,
                    importance=importance,
                    source_message_id=message_id,
                ):
                    added += 1

            if added > 0:
                logger.info(f"Добавлено {added} фактов в память user={user_id} agent={agent_id}")
            return added
        except json.JSONDecodeError as e:
            logger.warning(f"Не удалось распарсить JSON при извлечении памяти: {e}")
            return 0
        except Exception as e:
            logger.error(f"Ошибка извлечения памяти: {e}", exc_info=True)
            return 0

    def extract_and_save_memories(
        self,
        user_id: int,
        agent_id: int,
        user_message: str,
        agent_response: str,
        message_id: Optional[int] = None,
        langchain_service=None,
    ) -> None:
        """
        Запустить извлечение фактов в фоне (fire-and-forget).
        Не блокирует ответ пользователю.
        """
        asyncio.create_task(
            self.extract_and_save_memories_async(
                user_id=user_id,
                agent_id=agent_id,
                user_message=user_message,
                agent_response=agent_response,
                message_id=message_id,
                langchain_service=langchain_service,
            )
        )
