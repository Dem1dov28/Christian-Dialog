"""Security utilities and middleware for the application"""

import os
import re
import secrets
import hashlib
import hmac
import time
from typing import Optional, Tuple
from fastapi import Request, HTTPException, status
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from config import ENVIRONMENT

logger = logging.getLogger(__name__)

# Security configuration
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = False  # Опционально, можно включить для большей безопасности

# Password validation patterns
UPPERCASE_PATTERN = re.compile(r'[A-Z]')
LOWERCASE_PATTERN = re.compile(r'[a-z]')
DIGIT_PATTERN = re.compile(r'\d')
SPECIAL_PATTERN = re.compile(r'[!@#$%^&*(),.?":{}|<>]')


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password strength
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Пароль должен содержать минимум {MIN_PASSWORD_LENGTH} символов"
    
    if len(password) > MAX_PASSWORD_LENGTH:
        return False, f"Пароль не должен превышать {MAX_PASSWORD_LENGTH} символов"
    
    if REQUIRE_UPPERCASE and not UPPERCASE_PATTERN.search(password):
        return False, "Пароль должен содержать хотя бы одну заглавную букву"
    
    if REQUIRE_LOWERCASE and not LOWERCASE_PATTERN.search(password):
        return False, "Пароль должен содержать хотя бы одну строчную букву"
    
    if REQUIRE_DIGIT and not DIGIT_PATTERN.search(password):
        return False, "Пароль должен содержать хотя бы одну цифру"
    
    if REQUIRE_SPECIAL and not SPECIAL_PATTERN.search(password):
        return False, "Пароль должен содержать хотя бы один специальный символ"
    
    # Проверка на распространенные слабые пароли
    common_passwords = [
        "password", "password1", "12345678", "qwerty", "abc123", "password123",
        "admin", "letmein", "welcome", "monkey", "1234567890"
    ]
    if password.lower() in common_passwords:
        return False, "Пароль слишком простой. Используйте более сложный пароль"
    
    return True, None


def sanitize_input(text: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks
    
    Args:
        text: Input text to sanitize
        max_length: Maximum length (optional)
        
    Returns:
        Sanitized text
    """
    if not text:
        return ""
    
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Remove control characters except newlines and tabs
    text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
    
    # Limit length
    if max_length:
        text = text[:max_length]
    
    return text.strip()


def validate_path_traversal(file_path: str, base_dir: str) -> bool:
    """
    Validate that file path doesn't contain path traversal attempts
    
    Args:
        file_path: File path to validate
        base_dir: Base directory that should contain the file
        
    Returns:
        True if path is safe, False otherwise
    """
    try:
        from pathlib import Path
        
        # Normalize paths
        base_path = Path(base_dir).resolve()
        file_path_obj = Path(file_path).resolve()
        
        # Check if file_path is within base_path
        try:
            file_path_obj.relative_to(base_path)
            return True
        except ValueError:
            # Path is outside base directory
            return False
    except Exception as e:
        logger.error(f"Error validating path traversal: {e}")
        return False


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure random token
    
    Args:
        length: Token length in bytes
        
    Returns:
        Hex-encoded token string
    """
    return secrets.token_urlsafe(length)


def constant_time_compare(val1: str, val2: str) -> bool:
    """
    Compare two strings in constant time to prevent timing attacks
    
    Args:
        val1: First string
        val2: Second string
        
    Returns:
        True if strings are equal, False otherwise
    """
    return hmac.compare_digest(val1.encode('utf-8'), val2.encode('utf-8'))


def check_secret_key() -> None:
    """
    Check if SECRET_KEY is properly configured
    
    Raises:
        ValueError: If SECRET_KEY is not secure
    """
    secret_key = os.getenv("SECRET_KEY")
    
    if not secret_key:
        raise ValueError(
            "SECRET_KEY не установлен в переменных окружения. "
            "Установите SECRET_KEY в .env файле или переменных окружения."
        )
    
    # Check for default/insecure values
    insecure_values = [
        "your-secret-key-change-in-production",
        "your-super-secret-key-change-in-production-12345",
        "secret",
        "password",
        "12345"
    ]
    
    if secret_key in insecure_values:
        raise ValueError(
            "SECRET_KEY использует небезопасное значение по умолчанию. "
            "Установите уникальный, случайный SECRET_KEY длиной минимум 32 символа."
        )
    
    if len(secret_key) < 32:
        logger.warning(
            f"SECRET_KEY слишком короткий ({len(secret_key)} символов). "
            "Рекомендуется минимум 32 символа для безопасности."
        )
    
    # Check if key is too predictable
    if secret_key.isalnum() and len(set(secret_key)) < 10:
        logger.warning(
            "SECRET_KEY выглядит слишком предсказуемым. "
            "Используйте случайную строку с различными символами."
        )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Базовые security-заголовки
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Content Security Policy: более строгая в production
        if ENVIRONMENT == "production":
            csp = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self' https://api.openrouter.ai https://*.googleapis.com; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        else:
            # Более мягкая CSP для разработки (разрешаем unsafe-inline/eval для DevTools, HMR и т.п.)
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self' https://api.openrouter.ai https://*.googleapis.com http://localhost:5173 http://localhost:3000; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        response.headers["Content-Security-Policy"] = csp
        
        # HSTS (HTTP Strict Transport Security) - включаем только в production и при HTTPS
        if ENVIRONMENT == "production" and request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        
        # Дополнительные заголовки
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        
        # Для API-ответов запрещаем кеширование
        if request.url.path.startswith("/api/") or request.url.path.startswith("/auth/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        # Remove server information
        if "server" in response.headers:
            del response.headers["server"]
        
        return response


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other attacks
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path separators
    filename = filename.replace('/', '_').replace('\\', '_')
    
    # Remove path traversal attempts
    filename = filename.replace('..', '_')
    
    # Remove dangerous characters
    dangerous_chars = ['<', '>', ':', '"', '|', '?', '*', '\x00']
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        max_name_length = 255 - len(ext)
        filename = name[:max_name_length] + ext
    
    return filename

