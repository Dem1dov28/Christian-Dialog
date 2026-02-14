"""
Тесты ConversationService. Требуют DATABASE_URL (интеграционные).
"""
import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services.conversation_service import ConversationService

pytestmark = pytest.mark.integration


def test_conversation_service_get_unread_count_nonexistent():
    """get_unread_count для несуществующего разговора возвращает 0."""
    service = ConversationService()
    count = service.get_unread_count(999999999, is_group_chat=False)
    assert count == 0


def test_conversation_service_get_unread_count_group_nonexistent():
    """get_unread_count для несуществующего группового чата возвращает 0."""
    service = ConversationService()
    count = service.get_unread_count(999999999, is_group_chat=True)
    assert count == 0
