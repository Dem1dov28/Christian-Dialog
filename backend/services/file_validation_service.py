"""File validation service for file attachments"""

import os
import mimetypes
from typing import List, Optional, Tuple
from fastapi import UploadFile
import logging

logger = logging.getLogger(__name__)

# Allowed file extensions (whitelist)
ALLOWED_EXTENSIONS = {
    # Documents
    ".pdf", ".docx", ".doc", ".odt", ".rtf", ".txt", ".md",
    # Spreadsheets
    ".xlsx", ".csv", ".ods",
    # Code files
    ".py", ".js", ".ts", ".java", ".cpp", ".cs", ".html", ".css",
    ".json", ".xml", ".yaml", ".yml", ".toml", ".go", ".rs", ".rb",
    ".php", ".swift", ".kt", ".dart", ".sh", ".bash", ".zsh",
    # Images
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"
}

# MIME type mappings
MIME_TYPE_MAP = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "application/vnd.oasis.opendocument.text": ".odt",
    "application/rtf": ".rtf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "text/csv": ".csv",
    "application/vnd.oasis.opendocument.spreadsheet": ".ods",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpeg": ".jpeg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
}

# Maximum file size: 5MB
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

# Maximum number of files per message
MAX_FILES_PER_MESSAGE = 3


class FileValidationService:
    """Service for validating uploaded files"""
    
    def __init__(self):
        self.max_file_size = MAX_FILE_SIZE
        self.max_files_per_message = MAX_FILES_PER_MESSAGE
        self.allowed_extensions = ALLOWED_EXTENSIONS
    
    def validate_file_size(self, file: UploadFile, max_size: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """Validate file size
        
        Args:
            file: UploadFile object
            max_size: Maximum file size in bytes (default: 5MB)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        max_size = max_size or self.max_file_size
        
        # Read file size from content
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > max_size:
            size_mb = max_size / (1024 * 1024)
            return False, f"File size exceeds {size_mb}MB limit. Please select a smaller file."
        
        return True, None
    
    def validate_file_type(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """Validate file type (extension check)
        
        Args:
            file: UploadFile object
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        filename = file.filename or ""
        
        # Extract extension
        _, ext = os.path.splitext(filename.lower())
        
        if not ext or ext not in self.allowed_extensions:
            return False, "File type not supported. Supported types: PDF, DOCX, XLSX, images, and code files."
        
        return True, None
    
    def validate_file_count(self, files: List[UploadFile], max_count: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """Validate number of files
        
        Args:
            files: List of UploadFile objects
            max_count: Maximum number of files (default: 3)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        max_count = max_count or self.max_files_per_message
        
        if len(files) > max_count:
            return False, f"Maximum {max_count} files per message. Please remove a file first."
        
        return True, None
    
    def validate_filename(self, filename: str) -> str:
        """Sanitize filename
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
        """
        # Remove path separators and dangerous characters
        dangerous_chars = ['/', '\\', '..', '<', '>', ':', '"', '|', '?', '*']
        
        for char in dangerous_chars:
            filename = filename.replace(char, '_')
        
        # Limit length
        if len(filename) > 255:
            name, ext = os.path.splitext(filename)
            max_name_length = 255 - len(ext)
            filename = name[:max_name_length] + ext
        
        return filename
    
    def validate_content_type(self, file: UploadFile, expected_type: Optional[str] = None) -> Tuple[bool, Optional[str]]:
        """Validate MIME type (Content-Type header)
        
        Args:
            file: UploadFile object
            expected_type: Expected MIME type (optional)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        content_type = file.content_type or ""
        
        # If no content type, try to guess from filename
        if not content_type:
            filename = file.filename or ""
            guessed_type, _ = mimetypes.guess_type(filename)
            content_type = guessed_type or ""
        
        # If we have an expected type, validate against it
        if expected_type and content_type != expected_type:
            return False, f"File content type mismatch. Expected {expected_type}, got {content_type}"
        
        # Check if content type is in our allowed list
        if content_type:
            # Check if extension matches MIME type
            filename = file.filename or ""
            _, ext = os.path.splitext(filename.lower())
            
            if ext in MIME_TYPE_MAP.values():
                # Extension is allowed, MIME type validation is optional
                # But we can do a basic check
                if ext == ".pdf" and "pdf" not in content_type.lower():
                    return False, "File extension does not match content type"
        
        return True, None
    
    def validate_file(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """Validate a single file (all validations)
        
        Args:
            file: UploadFile object
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Validate size
        is_valid, error = self.validate_file_size(file)
        if not is_valid:
            return False, error
        
        # Validate type
        is_valid, error = self.validate_file_type(file)
        if not is_valid:
            return False, error
        
        # Validate filename
        sanitized_filename = self.validate_filename(file.filename or "")
        if not sanitized_filename:
            return False, "Invalid filename"
        
        # Validate content type (non-blocking)
        is_valid, error = self.validate_content_type(file)
        if not is_valid:
            logger.warning(f"Content type validation warning for {file.filename}: {error}")
            # Non-blocking, but log the warning
        
        return True, None
    
    def validate_files(self, files: List[UploadFile]) -> Tuple[bool, Optional[str], Optional[dict]]:
        """Validate multiple files
        
        Args:
            files: List of UploadFile objects
            
        Returns:
            Tuple of (is_valid, error_message, validation_results)
            validation_results: dict mapping file index to (is_valid, error_message)
        """
        # Validate file count
        is_valid, error = self.validate_file_count(files)
        if not is_valid:
            return False, error, None
        
        # Validate each file
        validation_results = {}
        all_valid = True
        
        for idx, file in enumerate(files):
            is_valid, error = self.validate_file(file)
            validation_results[idx] = (is_valid, error)
            if not is_valid:
                all_valid = False
        
        if not all_valid:
            # Return first error message
            for idx, (is_valid, error) in validation_results.items():
                if not is_valid:
                    filename = files[idx].filename or "Unknown file"
                    return False, f"{filename}: {error}", validation_results
        
        return True, None, validation_results

