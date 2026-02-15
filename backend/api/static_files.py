"""
Роуты раздачи статических файлов и экспортов (без авторизации где применимо).
Защита: sanitize_filename, validate_path_traversal.
"""
import os
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from core.security import sanitize_filename, validate_path_traversal

logger = logging.getLogger(__name__)

router = APIRouter(tags=["static"])

MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def _serve_safe_file(base_dir: str, filename: str, description: str) -> FileResponse:
    """Безопасная раздача файла из base_dir (path traversal + sanitize)."""
    sanitized = sanitize_filename(filename)
    base_abs = os.path.abspath(base_dir)
    filepath = os.path.join(base_abs, sanitized)
    if not validate_path_traversal(filepath, base_abs):
        logger.warning(f"Path traversal attempt in {description}: {filename}")
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")
    ext = os.path.splitext(filename)[1].lower()
    media_type = MEDIA_TYPES.get(ext, "application/octet-stream")
    response = FileResponse(path=filepath, media_type=media_type)
    # Добавляем CORS-заголовки для статических файлов
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@router.get("/api/download/{filename}")
def download_export(filename: str):
    """Скачивание экспортированных файлов (exports/)."""
    base = os.path.abspath("exports")
    sanitized = sanitize_filename(filename)
    base_abs = os.path.abspath(base)
    filepath = os.path.join(base_abs, sanitized)
    if not validate_path_traversal(filepath, base_abs):
        logger.warning("Path traversal attempt in export: %s", filename)
        raise HTTPException(status_code=400, detail="Недопустимое имя файла")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Файл не найден")
    return FileResponse(
        path=filepath,
        filename=sanitized,
        media_type="application/octet-stream",
    )


@router.get("/api/avatars/{filename}")
def get_avatar(filename: str):
    """Получение аватара пользователя (uploads/avatars/)."""
    base = os.path.abspath(os.path.join("uploads", "avatars"))
    return _serve_safe_file(base, filename, "avatar")


@router.get("/static/user_agents/{filename:path}")
def get_user_agent_avatar(filename: str):
    """Получение аватара пользовательского персонажа (static/user_agents/)."""
    base = os.path.abspath("static/user_agents")
    return _serve_safe_file(base, filename, "user_agent_avatar")


@router.get("/static/group_chats/{filename:path}")
def get_group_chat_avatar(filename: str):
    """Получение аватара группового чата (static/group_chats/)."""
    base = os.path.abspath("static/group_chats")
    return _serve_safe_file(base, filename, "group_chat_avatar")
