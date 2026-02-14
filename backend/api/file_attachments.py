"""
Скачивание файловых вложений из сообщений (авторизованный доступ).
"""
import os
import logging
import urllib.parse
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlmodel import Session, select

from core.database import get_session
from core.dependencies import get_current_user
from core.security import validate_path_traversal
from models.file_attachment import FileAttachment
from models.user import User
from models.conversation import Conversation

logger = logging.getLogger(__name__)

router = APIRouter(tags=["files"])


@router.get("/api/files/{filename:path}")
async def download_file_attachment(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Скачивание файловых вложений из сообщений.

    Args:
        filename: Имя файла (stored filename) — может быть URL-encoded.
        current_user: Текущий авторизованный пользователь.
        db: Сессия базы данных.

    Returns:
        Response с телом файла и заголовками Content-Disposition, Content-Length.
    """
    try:
        decoded_filename = unquote(filename)
    except Exception as e:
        logger.warning("Failed to decode filename %s: %s", filename, e)
        decoded_filename = filename

    statement = select(FileAttachment).where(FileAttachment.filename == decoded_filename)
    file_attachment = db.exec(statement).first()

    if not file_attachment:
        logger.warning("File not found in database: %s", decoded_filename)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if file_attachment.user_id != current_user.id:
        conversation = db.get(Conversation, file_attachment.conversation_id)
        if not conversation or conversation.user_id != current_user.id:
            logger.warning(
                "Unauthorized file access: user %s tried to access file %s (owner %s)",
                current_user.id,
                file_attachment.filename,
                file_attachment.user_id,
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if file_attachment.virus_scan_status == "infected":
        logger.warning("Attempted to download infected file: %s", file_attachment.filename)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="File rejected: Virus detected in uploaded file",
        )

    file_path = os.path.normpath(file_attachment.file_path)
    base_upload_dir = os.path.abspath("backend/uploads")
    if not validate_path_traversal(file_path, base_upload_dir):
        logger.warning(
            "Path traversal attempt: user %s, file_path %s",
            current_user.id,
            file_path,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if not os.path.exists(file_path):
        logger.error("File not found on filesystem: %s", file_path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on filesystem",
        )

    is_image = file_attachment.file_type and file_attachment.file_type.startswith("image/")
    disposition = "inline" if is_image else "attachment"
    original_filename = file_attachment.original_filename

    try:
        has_non_ascii = any(ord(c) > 127 for c in original_filename)
        if has_non_ascii:
            encoded = urllib.parse.quote(original_filename, safe="")
            content_disposition = f"{disposition}; filename*=UTF-8''{encoded}"
        else:
            content_disposition = f'{disposition}; filename="{original_filename}"'
    except Exception as e:
        logger.warning("Failed to encode filename %s: %s", original_filename, e)
        try:
            safe = original_filename.encode("ascii", "ignore").decode("ascii")
            content_disposition = f'{disposition}; filename="{safe}"'
        except Exception:
            content_disposition = f'{disposition}; filename="download"'

    try:
        with open(file_path, "rb") as f:
            file_content = f.read()
        logger.info(
            "Serving file: %s (original: %s) to user %s",
            file_attachment.filename,
            original_filename,
            current_user.id,
        )
        return Response(
            content=file_content,
            media_type=file_attachment.file_type or "application/octet-stream",
            headers={
                "Content-Disposition": content_disposition,
                "Content-Length": str(len(file_content)),
            },
        )
    except Exception as e:
        logger.error("Error reading file %s: %s", file_path, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error reading file",
        )
