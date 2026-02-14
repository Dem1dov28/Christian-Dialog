"""
Тесты API агентов (модели и сериализация). Требуют DATABASE_URL.
"""
import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlmodel import Session, select
from models.agent import Agent, AgentPublic
from core.database import engine

pytestmark = pytest.mark.integration


def test_agents_model_and_serialization():
    """Проверка получения агентов из БД и сериализации в AgentPublic."""
    with Session(engine) as session:
        agents = session.exec(select(Agent)).all()
        assert isinstance(agents, list)
        for agent in agents:
            assert agent.name
            agent_public = AgentPublic.model_validate(agent)
            assert agent_public.category == agent.category
            d = agent_public.model_dump()
            assert "category" in d
            assert d.get("name") == agent.name
