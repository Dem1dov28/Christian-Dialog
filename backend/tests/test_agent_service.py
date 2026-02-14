"""
Тесты AgentService. Требуют DATABASE_URL (интеграционные).
"""
import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from services.agent_service import AgentService
from models.agent import AgentPublic

pytestmark = pytest.mark.integration


def test_agent_service_get_agent_nonexistent():
    """get_agent с несуществующим ID возвращает None."""
    service = AgentService()
    result = service.get_agent(999999999)
    assert result is None


def test_agent_service_get_all_agents_returns_list():
    """get_all_agents возвращает список (AgentPublic)."""
    service = AgentService()
    result = service.get_all_agents()
    assert isinstance(result, list)
    for item in result:
        assert isinstance(item, AgentPublic)
        assert item.id is not None
        assert isinstance(item.name, str)


def test_agent_service_get_all_agents_filter_by_category():
    """get_all_agents с category возвращает подмножество."""
    service = AgentService()
    all_agents = service.get_all_agents()
    if not all_agents:
        pytest.skip("Нет агентов в БД")
    category = all_agents[0].category or "general"
    filtered = service.get_all_agents(category=category)
    assert isinstance(filtered, list)
    for item in filtered:
        assert item.category == category or (category in (item.category or "").split(","))
