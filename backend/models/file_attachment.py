from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional


class FileAttachmentBase(SQLModel):
    """Базовая модель файлового вложения"""
    filename: str = Field(..., max_length=255, index=True, description="Stored filename on filesystem (UUID + original name)")
    original_filename: str = Field(..., max_length=255, description="Original filename from user upload")
    file_path: str = Field(..., max_length=500, description="Full filesystem path to the file")
    file_size: int = Field(..., ge=0, description="File size in bytes")
    file_type: str = Field(..., max_length=50, description="MIME type (e.g., 'application/pdf', 'image/png')")
    file_extension: str = Field(..., max_length=10, description="File extension (e.g., 'pdf', 'png', 'docx')")
    user_id: int = Field(..., foreign_key="user.id", index=True, description="User who uploaded the file")
    conversation_id: int = Field(..., foreign_key="conversation.id", index=True, description="Conversation the file belongs to")
    message_id: int = Field(..., foreign_key="message.id", index=True, description="Message the file is attached to")
    virus_scan_status: Optional[str] = Field(default="pending", max_length=20, description="Virus scan result: 'clean', 'infected', 'error', 'pending'")
    virus_scan_date: Optional[datetime] = Field(default=None, description="Timestamp when virus scan was performed")


class FileAttachment(FileAttachmentBase, table=True):
    """Модель файлового вложения в базе данных"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Связи
    user: Optional["User"] = Relationship(back_populates="file_attachments")
    conversation: Optional["Conversation"] = Relationship(back_populates="file_attachments")
    message: Optional["Message"] = Relationship(back_populates="file_attachments")


class FileAttachmentPublic(SQLModel):
    """Публичная модель файлового вложения для API ответов"""
    id: int
    filename: str
    original_filename: str
    file_size: int
    file_type: str
    file_extension: str
    created_at: datetime
    virus_scan_status: Optional[str] = None


class FileAttachmentCreate(SQLModel):
    """Модель для создания файлового вложения"""
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    file_type: str
    file_extension: str
    user_id: int
    conversation_id: int
    message_id: int

