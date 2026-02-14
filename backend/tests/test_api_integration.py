"""
Интеграционные тесты API (требуют DATABASE_URL и запускают lifespan приложения).
Запуск: pytest tests/test_api_integration.py -v
В CI: задайте DATABASE_URL (PostgreSQL).
"""
import pytest

pytestmark = pytest.mark.integration


class TestHealthEndpoints:
    """Тесты публичных эндпоинтов без аутентификации."""

    def test_read_root(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "docs" in data

    def test_read_api_info(self, client):
        response = client.get("/api")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "docs" in data
        assert "agents" in data or "chat" in data

    def test_docs_redirect_or_ok(self, client):
        response = client.get("/docs", follow_redirects=True)
        assert response.status_code == 200

    def test_openapi_json(self, client):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data

    def test_health(self, client):
        """Эндпоинт /health для мониторинга."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json().get("status") == "ok"


class TestSearchEndpoint:
    """Тест эндпоинта поиска (инициализация сервиса)."""

    def test_test_search_returns_200(self, client):
        response = client.get("/test-search")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in ("success", "error")
