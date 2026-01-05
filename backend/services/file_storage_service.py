"""File storage service for file attachments"""

import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from sqlmodel import Session, select
from datetime import datetime
import logging

from models.file_attachment import FileAttachment, FileAttachmentCreate
from services.file_validation_service import FileValidationService

logger = logging.getLogger(__name__)


class FileStorageService:
    """Service for storing and managing file attachments"""
    
    def __init__(self):
        self.base_upload_dir = Path("backend/uploads")
        self.validation_service = FileValidationService()
    
    def _get_upload_dir(self, user_id: int, conversation_id: int) -> Path:
        """Get upload directory for user and conversation
        
        Args:
            user_id: User ID
            conversation_id: Conversation ID
            
        Returns:
            Path to upload directory
        """
        upload_dir = self.base_upload_dir / str(user_id) / str(conversation_id)
        return upload_dir
    
    def _generate_filename(self, original_filename: str) -> str:
        """Generate unique filename with UUID prefix
        
        Args:
            original_filename: Original filename from user
            
        Returns:
            Generated filename: {uuid}_{sanitized_original_filename}
        """
        # Sanitize filename
        sanitized = self.validation_service.validate_filename(original_filename)
        
        # Generate UUID
        file_uuid = str(uuid.uuid4())
        
        # Extract extension
        name, ext = os.path.splitext(sanitized)
        
        # Combine: {uuid}_{original_name}{ext}
        generated_filename = f"{file_uuid}_{sanitized}"
        
        return generated_filename
    
    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension from filename
        
        Args:
            filename: Filename
            
        Returns:
            File extension (with dot, e.g., '.pdf')
        """
        _, ext = os.path.splitext(filename.lower())
        return ext
    
    def save_file(
        self,
        session: Session,
        user_id: int,
        conversation_id: int,
        message_id: int,
        file: UploadFile,
        original_filename: Optional[str] = None
    ) -> FileAttachment:
        """Save file to filesystem and create database record
        
        Args:
            session: Database session
            user_id: User ID
            conversation_id: Conversation ID
            message_id: Message ID
            file: UploadFile object
            original_filename: Original filename (if different from file.filename)
            
        Returns:
            FileAttachment object
            
        Raises:
            ValueError: If file validation fails
            IOError: If file cannot be saved
        """
        # Get original filename
        original_filename = original_filename or file.filename or "unknown_file"
        
        # Validate file
        is_valid, error = self.validation_service.validate_file(file)
        if not is_valid:
            raise ValueError(f"File validation failed: {error}")
        
        # Get upload directory
        upload_dir = self._get_upload_dir(user_id, conversation_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        generated_filename = self._generate_filename(original_filename)
        file_path = upload_dir / generated_filename
        
        # Get file size
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        # Get file type and extension
        file_type = file.content_type or "application/octet-stream"
        file_extension = self._get_file_extension(original_filename)
        
        # Save file to filesystem
        try:
            with open(file_path, "wb") as f:
                # Read file in chunks
                while True:
                    chunk = file.file.read(8192)  # 8KB chunks
                    if not chunk:
                        break
                    f.write(chunk)
        except IOError as e:
            logger.error(f"Failed to save file {original_filename}: {e}")
            raise IOError(f"Failed to save file: {e}")
        
        # Create database record
        file_attachment = FileAttachment(
            filename=generated_filename,
            original_filename=original_filename,
            file_path=str(file_path),
            file_size=file_size,
            file_type=file_type,
            file_extension=file_extension,
            user_id=user_id,
            conversation_id=conversation_id,
            message_id=message_id,
            virus_scan_status="pending",
            created_at=datetime.utcnow()
        )
        
        session.add(file_attachment)
        session.commit()
        session.refresh(file_attachment)
        
        logger.info(f"File saved: {file_path} (ID: {file_attachment.id})")
        
        return file_attachment
    
    def get_file_path(self, session: Session, file_attachment_id: int) -> Optional[str]:
        """Get file path from database
        
        Args:
            session: Database session
            file_attachment_id: File attachment ID
            
        Returns:
            File path if exists, None otherwise
        """
        statement = select(FileAttachment).where(FileAttachment.id == file_attachment_id)
        file_attachment = session.exec(statement).first()
        
        if not file_attachment:
            return None
        
        # Verify file exists on filesystem
        file_path = Path(file_attachment.file_path)
        if not file_path.exists():
            logger.warning(f"File not found on filesystem: {file_path}")
            return None
        
        return str(file_path)
    
    def get_file_attachment(self, session: Session, file_attachment_id: int) -> Optional[FileAttachment]:
        """Get file attachment from database
        
        Args:
            session: Database session
            file_attachment_id: File attachment ID
            
        Returns:
            FileAttachment object if exists, None otherwise
        """
        statement = select(FileAttachment).where(FileAttachment.id == file_attachment_id)
        return session.exec(statement).first()
    
    def get_file_attachment_by_filename(self, session: Session, filename: str) -> Optional[FileAttachment]:
        """Get file attachment by filename
        
        Args:
            session: Database session
            filename: Filename
            
        Returns:
            FileAttachment object if exists, None otherwise
        """
        statement = select(FileAttachment).where(FileAttachment.filename == filename)
        return session.exec(statement).first()
    
    def delete_file(self, session: Session, file_attachment_id: int) -> bool:
        """Delete file from filesystem and database
        
        Args:
            session: Database session
            file_attachment_id: File attachment ID
            
        Returns:
            True if deleted successfully, False otherwise
        """
        statement = select(FileAttachment).where(FileAttachment.id == file_attachment_id)
        file_attachment = session.exec(statement).first()
        
        if not file_attachment:
            return False
        
        # Delete from filesystem
        file_path = Path(file_attachment.file_path)
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"File deleted from filesystem: {file_path}")
        except IOError as e:
            logger.error(f"Failed to delete file {file_path}: {e}")
            # Continue with database deletion even if filesystem deletion fails
        
        # Delete from database
        session.delete(file_attachment)
        session.commit()
        
        logger.info(f"File attachment deleted from database (ID: {file_attachment_id})")
        
        return True
    
    def delete_files_by_message(self, session: Session, message_id: int) -> int:
        """Delete all files associated with a message
        
        Args:
            session: Database session
            message_id: Message ID
            
        Returns:
            Number of files deleted
        """
        statement = select(FileAttachment).where(FileAttachment.message_id == message_id)
        file_attachments = session.exec(statement).all()
        
        deleted_count = 0
        for file_attachment in file_attachments:
            if self.delete_file(session, file_attachment.id):
                deleted_count += 1
        
        return deleted_count
    
    def delete_files_by_conversation(self, session: Session, conversation_id: int) -> int:
        """Delete all files associated with a conversation
        
        Args:
            session: Database session
            conversation_id: Conversation ID
            
        Returns:
            Number of files deleted
        """
        statement = select(FileAttachment).where(FileAttachment.conversation_id == conversation_id)
        file_attachments = session.exec(statement).all()
        
        if not file_attachments:
            return 0
        
        deleted_count = 0
        user_id = None
        for file_attachment in file_attachments:
            if user_id is None:
                user_id = file_attachment.user_id
            if self.delete_file(session, file_attachment.id):
                deleted_count += 1
        
        # Clean up empty directories (only if we have user_id)
        if user_id is not None:
            upload_dir = self.base_upload_dir / str(user_id) / str(conversation_id)
            try:
                if upload_dir.exists() and not any(upload_dir.iterdir()):
                    upload_dir.rmdir()
                    logger.info(f"Removed empty directory: {upload_dir}")
            except IOError as e:
                logger.warning(f"Failed to remove directory {upload_dir}: {e}")
        
        return deleted_count

