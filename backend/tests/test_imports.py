"""
Тест корректности импортов ключевых модулей (без запуска БД).
"""
import pytest
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

pytestmark = pytest.mark.unit


def test_import_models():
    """Импорт моделей."""
    from models.folder import Folder, FolderPublic, FolderCreate, FolderUpdate
    from models.agent import Agent, AgentPublic
    from models.conversation import Conversation
    from models.user import User


def test_import_folder_service():
    """Импорт сервиса папок."""
    from services.folder_service import FolderService


def test_import_api_folders():
    """Импорт API папок."""
    from api.folders import create_folder_endpoints


def test_folder_service_instance():
    """Создание экземпляра FolderService."""
    from services.folder_service import FolderService
    svc = FolderService()
    assert svc is not None


def test_folder_create_model():
    """Создание Pydantic-модели FolderCreate."""
    from models.folder import FolderCreate
    data = FolderCreate(name="Тест", description="Описание", folder_type="custom")
    assert data.name == "Тест"
    assert data.folder_type == "custom"
