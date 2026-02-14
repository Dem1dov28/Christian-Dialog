"""
Pytest fixtures для backend тестов.

Для интеграционных тестов требуется DATABASE_URL в окружении
(например, в .env или в CI). Без DATABASE_URL тесты, использующие client, будут падать при импорте app.
"""
import os
import sys
from pathlib import Path

# Добавляем корень backend в path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Загружаем .env из backend перед импортом app (если есть)
try:
    from dotenv import load_dotenv
    env_path = backend_dir / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass


def pytest_configure(config):
    """Маркеры для тестов."""
    config.addinivalue_line("markers", "integration: интеграционные тесты (требуют БД и app)")
    config.addinivalue_line("markers", "unit: юнит-тесты (не требуют БД)")


def pytest_collection_modifyitems(config, items):
    """Пропускать интеграционные тесты, если нет DATABASE_URL."""
    skip_integration = not os.getenv("DATABASE_URL")
    for item in items:
        if "integration" in item.keywords and skip_integration:
            item.add_marker(
                __import__("pytest").mark.skip(reason="DATABASE_URL не задан, пропуск интеграционного теста")
            )


def get_test_client():
    """Создать TestClient для FastAPI app. Используется в фикстуре client."""
    from httpx import ASGITransport, AsyncClient
    from main import app
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


def get_sync_test_client():
    """Синхронный TestClient (для простых тестов без async)."""
    from starlette.testclient import TestClient
    from main import app
    return TestClient(app)


import pytest


@pytest.fixture
def client():
    """Синхронный HTTP клиент для тестирования API. Требует DATABASE_URL."""
    with get_sync_test_client() as c:
        yield c

