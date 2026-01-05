from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from pydantic import BaseModel
from typing import Optional, List


class TestAnswerBase(SQLModel):
    """Базовая модель ответа на тест"""
    test_id: str = Field(..., index=True)  # Уникальный ID теста из HTML (data-test-id)
    conversation_id: int = Field(..., foreign_key="conversation.id", index=True)
    question_id: str = Field(..., index=True)  # ID вопроса из теста (data-question-id)
    question_text: str  # Текст вопроса
    user_answer: str  # Ответ пользователя
    is_correct: bool  # Правильный ли ответ
    agent_id: Optional[int] = Field(default=None, foreign_key="agent.id")


class TestAnswer(TestAnswerBase, table=True):
    """Модель ответа на тест в БД"""
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Связи
    conversation: Optional["Conversation"] = Relationship(back_populates="test_answers")
    agent: Optional["Agent"] = Relationship(back_populates="test_answers")


class TestAnswerPublic(BaseModel):
    """Публичная модель ответа на тест"""
    id: int
    test_id: str
    conversation_id: int
    question_id: str
    question_text: str
    user_answer: str
    is_correct: bool
    created_at: datetime
    agent_id: Optional[int] = None


class TestResultSummary(BaseModel):
    """Сводка по результатам теста"""
    test_id: str
    total_questions: int
    correct_answers: int
    incorrect_answers: int
    percentage: float
    answers: List[TestAnswerPublic]

