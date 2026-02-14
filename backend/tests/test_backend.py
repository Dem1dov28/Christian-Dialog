"""
Интеграционные тесты работы backend (эндпоинты /api и auth).
Требуют DATABASE_URL. Используют fixture client.
"""
import pytest

pytestmark = pytest.mark.integration


def test_api_endpoint(client):
    """Основной API возвращает 200 и ожидаемые поля."""
    response = client.get("/api")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data


def test_auth_router_available(client):
    """Auth router доступен (эндпоинт /auth/test или аналогичный)."""
    # Проверяем, что auth зарегистрирован — через openapi
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json().get("paths", {})
    auth_paths = [p for p in paths if "auth" in p.lower()]
    assert len(auth_paths) >= 1, "Ожидается хотя бы один auth path в API"
