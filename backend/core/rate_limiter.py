"""Rate limiting middleware and utilities"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Tuple
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple in-memory rate limiter (для production лучше использовать Redis)"""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = timedelta(minutes=5)
        self.last_cleanup = datetime.utcnow()
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Используем IP адрес
        client_ip = request.client.host if request.client else "unknown"
        
        # Для авторизованных пользователей можно использовать user_id
        # Но для простоты используем IP
        return client_ip
    
    def _cleanup_old_entries(self):
        """Remove old entries to prevent memory leak"""
        now = datetime.utcnow()
        if now - self.last_cleanup < self.cleanup_interval:
            return
        
        cutoff_time = now - timedelta(hours=1)
        for client_id in list(self.requests.keys()):
            self.requests[client_id] = [
                req_time for req_time in self.requests[client_id]
                if req_time > cutoff_time
            ]
            if not self.requests[client_id]:
                del self.requests[client_id]
        
        self.last_cleanup = now
    
    def is_allowed(
        self,
        client_id: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, int]:
        """
        Check if request is allowed
        
        Args:
            client_id: Client identifier
            max_requests: Maximum number of requests
            window_seconds: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        self._cleanup_old_entries()
        
        now = datetime.utcnow()
        cutoff_time = now - timedelta(seconds=window_seconds)
        
        # Filter requests within time window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if req_time > cutoff_time
        ]
        
        # Check if limit exceeded
        request_count = len(self.requests[client_id])
        if request_count >= max_requests:
            return False, 0
        
        # Add current request
        self.requests[client_id].append(now)
        
        remaining = max_requests - request_count - 1
        return True, remaining


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations
RATE_LIMITS = {
    # Authentication endpoints - увеличены лимиты для удобства разработки
    "/auth/login": (50, 60),      # до 50 попыток в минуту (было 10)
    "/auth/register": (20, 600),  # 20 попыток за 10 минут (было 5)
    "/auth/google": (50, 300),    # 50 попыток за 5 минут (было 30)
    
    # Основные действия в чате — повышаем порог, чтобы UX не страдал
    "/chat/new": (1000, 60),      # создание новых чатов до 1000/мин (значительно увеличено для активного использования)
    "/chat/send": (150, 60),      # отправка сообщений — до 150/мин (примерно 2–3 в секунду)
    "/multi-agent-chat": (120, 60),  # загрузка/обновление групповых чатов
    
    # Загрузка сообщений — увеличиваем лимит для загрузки истории чатов
    "/conversations": (500, 60),  # до 500 запросов в минуту для загрузки сообщений и чатов
    
    # Загрузка файлов/аватаров — все ещё ограничиваем, но позволяя тестировать
    "/api/files": (30, 60),       # до 30 загрузок в минуту
    "/auth/me/avatar": (20, 300), # до 20 загрузок за 5 минут
    
    # Базовый лимит для прочих маршрутов
    "default": (300, 60),         # 300 запросов в минуту
}


def get_rate_limit(path: str) -> Tuple[int, int]:
    """
    Get rate limit configuration for a path
    
    Args:
        path: Request path
        
    Returns:
        Tuple of (max_requests, window_seconds)
    """
    # Check exact path matches first
    if path in RATE_LIMITS:
        return RATE_LIMITS[path]
    
    # Check prefix matches
    for prefix, limits in RATE_LIMITS.items():
        if prefix != "default" and path.startswith(prefix):
            return limits
    
    # Return default
    return RATE_LIMITS["default"]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limiting"""
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for OPTIONS requests
        if request.method == "OPTIONS":
            return await call_next(request)
        
        # Get rate limit configuration
        path = request.url.path
        max_requests, window_seconds = get_rate_limit(path)
        
        # Get client identifier
        client_id = rate_limiter._get_client_id(request)
        
        # Check rate limit
        is_allowed, remaining = rate_limiter.is_allowed(
            client_id, max_requests, window_seconds
        )
        
        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded for {client_id} on {path}. "
                f"Limit: {max_requests} requests per {window_seconds} seconds"
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Превышен лимит запросов. Пожалуйста, подождите {window_seconds} секунд перед повторной попыткой.",
                    "retry_after": window_seconds
                },
                headers={
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Window": str(window_seconds),
                    "Retry-After": str(window_seconds)
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(window_seconds)
        
        return response


