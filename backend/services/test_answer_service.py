"""Сервис для работы с ответами на тесты"""
from typing import List, Optional, Dict
from sqlmodel import Session, select
from datetime import datetime
import logging

from models.test_answer import TestAnswer, TestAnswerPublic, TestResultSummary
from core.database import engine

logger = logging.getLogger(__name__)


class TestAnswerService:
    """Сервис для работы с ответами на тесты"""
    
    def get_session(self) -> Session:
        """Получить сессию БД"""
        return Session(engine)
    
    def save_test_answers(
        self,
        test_id: str,
        conversation_id: int,
        agent_id: Optional[int],
        answers: List[Dict[str, any]]
    ) -> List[TestAnswerPublic]:
        """Сохранить ответы на тест в БД
        
        Args:
            test_id: Уникальный ID теста
            conversation_id: ID беседы
            agent_id: ID агента (опционально)
            answers: Список ответов в формате [{"question_id": "1", "question": "...", "answer": "...", "is_correct": True}, ...]
            
        Returns:
            Список сохраненных ответов
        """
        try:
            with self.get_session() as session:
                saved_answers = []
                
                for answer_data in answers:
                    test_answer = TestAnswer(
                        test_id=test_id,
                        conversation_id=conversation_id,
                        agent_id=agent_id,
                        question_id=answer_data.get("question_id"),
                        question_text=answer_data.get("question", ""),
                        user_answer=answer_data.get("answer", ""),
                        is_correct=answer_data.get("is_correct", False)
                    )
                    
                    session.add(test_answer)
                    saved_answers.append(test_answer)
                
                session.commit()
                
                # Обновляем объекты из БД для получения ID
                for answer in saved_answers:
                    session.refresh(answer)
                
                logger.info(f"Saved {len(saved_answers)} test answers for test_id={test_id}, conversation_id={conversation_id}")
                
                return [
                    TestAnswerPublic(
                        id=answer.id,
                        test_id=answer.test_id,
                        conversation_id=answer.conversation_id,
                        question_id=answer.question_id,
                        question_text=answer.question_text,
                        user_answer=answer.user_answer,
                        is_correct=answer.is_correct,
                        created_at=answer.created_at,
                        agent_id=answer.agent_id
                    )
                    for answer in saved_answers
                ]
                
        except Exception as e:
            logger.error(f"Error saving test answers: {e}", exc_info=True)
            raise
    
    def get_test_results(
        self,
        test_id: str,
        conversation_id: int
    ) -> Optional[TestResultSummary]:
        """Получить результаты теста
        
        Args:
            test_id: Уникальный ID теста
            conversation_id: ID беседы
            
        Returns:
            Сводка по результатам теста или None если тест не найден
        """
        try:
            with self.get_session() as session:
                statement = (
                    select(TestAnswer)
                    .where(TestAnswer.test_id == test_id)
                    .where(TestAnswer.conversation_id == conversation_id)
                    .order_by(TestAnswer.question_id.asc())
                )
                answers = session.exec(statement).all()
                
                if not answers:
                    return None
                
                total_questions = len(answers)
                correct_answers = sum(1 for a in answers if a.is_correct)
                incorrect_answers = total_questions - correct_answers
                percentage = (correct_answers / total_questions * 100) if total_questions > 0 else 0
                
                return TestResultSummary(
                    test_id=test_id,
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    incorrect_answers=incorrect_answers,
                    percentage=round(percentage, 1),
                    answers=[
                        TestAnswerPublic(
                            id=answer.id,
                            test_id=answer.test_id,
                            conversation_id=answer.conversation_id,
                            question_id=answer.question_id,
                            question_text=answer.question_text,
                            user_answer=answer.user_answer,
                            is_correct=answer.is_correct,
                            created_at=answer.created_at,
                            agent_id=answer.agent_id
                        )
                        for answer in answers
                    ]
                )
                
        except Exception as e:
            logger.error(f"Error getting test results: {e}", exc_info=True)
            return None
    
    def get_latest_test_result(
        self,
        conversation_id: int
    ) -> Optional[TestResultSummary]:
        """Получить результаты последнего теста в беседе
        
        Args:
            conversation_id: ID беседы
            
        Returns:
            Сводка по результатам последнего теста или None
        """
        try:
            with self.get_session() as session:
                # Находим последний test_id для этой беседы
                statement = (
                    select(TestAnswer.test_id)
                    .where(TestAnswer.conversation_id == conversation_id)
                    .order_by(TestAnswer.created_at.desc())
                    .limit(1)
                )
                latest_test_id = session.exec(statement).first()
                
                if not latest_test_id:
                    return None
                
                return self.get_test_results(latest_test_id, conversation_id)
                
        except Exception as e:
            logger.error(f"Error getting latest test result: {e}", exc_info=True)
            return None

