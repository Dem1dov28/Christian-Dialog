# ПОЛНЫЙ АУДИТ БЕЗОПАСНОСТИ ПРИЛОЖЕНИЯ EPOCHAL DIALOG

**Дата проверки:** 12 февраля 2026  
**Статус:** Требуется внимание к критическим аспектам перед production deployment

---

## 📋 СОДЕРЖАНИЕ

1. [Общая оценка](#общая-оценка)
2. [Критические уязвимости (требуют немедленного исправления)](#критические-уязвимости)
3. [Высокий приоритет](#высокий-приоритет)
4. [Средний приоритет](#средний-приоритет)
5. [Низкий приоритет](#низкий-приоритет)
6. [Положительные аспекты](#положительные-аспекты)
7. [Чеклист перед деплоем](#чеклист-перед-деплоем)

---

## ОБЩАЯ ОЦЕНКА

**Уровень безопасности:** ⚠️ **ТРЕБУЕТСЯ УЛУЧШЕНИЕ**

**Оценка по категориям:**
- Аутентификация и авторизация: 7/10 ✅
- Защита данных: 6/10 ⚠️
- Инфраструктура и конфигурация: 4/10 ⚠️
- Защита от атак: 7/10 ✅
- Логирование и мониторинг: 5/10 ⚠️
- Безопасность файлов: 8/10 ✅

---

## ❌ КРИТИЧЕСКИЕ УЯЗВИМОСТИ

### 🔴 1. ЭКСПОЗИЦИЯ СЕКРЕТОВ В DOCKER-COMPOSE

**Файл:** `docker-compose.yml`  
**Проблема:** Пароль базы данных и учетные данные прописаны в открытом виде

```yaml
# ПЛОХО - текущая конфигурация
environment:
  POSTGRES_PASSWORD: timetalk_92305FqYic54Op
  PGADMIN_DEFAULT_PASSWORD: admin
```

**Риски:**
- ✗ Любой с доступом к репозиторию видит пароль БД
- ✗ Пароль попадает в Git историю
- ✗ Компрометация всей базы данных

**РЕШЕНИЕ:**

```yaml
# ПРАВИЛЬНО - использовать переменные окружения
services:
  postgresql:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_DB: ${DB_NAME}
  
  pgadmin:
    environment:
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL}
```

**Файл `.env` (НЕ коммитить в Git!):**
```env
DB_PASSWORD=<генерировать_сложный_пароль>
DB_USER=timetalk_user
DB_NAME=timetalk
PGADMIN_PASSWORD=<генерировать_сложный_пароль>
PGADMIN_EMAIL=admin@yourdomain.com
```

**Немедленные действия:**
1. Создать `.env` файл с реальными секретами
2. Добавить `.env` в `.gitignore` (проверить что уже добавлен)
3. Удалить пароли из `docker-compose.yml`
4. Сменить все пароли в production
5. Создать `.env.example` с placeholder значениями

---

### 🔴 2. SECRET_KEY ПО УМОЛЧАНИЮ

**Файл:** `backend/core/auth.py`, `backend/config/config.py`  
**Проблема:** Используется предсказуемый SECRET_KEY

```python
# ПЛОХО
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
```

**Риски:**
- ✗ Возможность подделки JWT токенов
- ✗ Несанкционированный доступ к любому аккаунту
- ✗ Компрометация всех сессий пользователей

**РЕШЕНИЕ:**

```python
# backend/config/config.py
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError(
        "❌ КРИТИЧЕСКАЯ ОШИБКА: SECRET_KEY не установлен!\n"
        "Для генерации безопасного ключа выполните:\n"
        "  python -c 'import secrets; print(secrets.token_urlsafe(64))'\n"
        "И добавьте в .env файл:\n"
        "  SECRET_KEY=<сгенерированный_ключ>"
    )

if len(SECRET_KEY) < 32:
    raise ValueError(
        f"❌ SECRET_KEY слишком короткий ({len(SECRET_KEY)} символов).\n"
        "Требуется минимум 32 символа (рекомендуется 64)."
    )
```

**Генерация безопасного ключа:**
```bash
# Выполните в терминале:
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
```

---

### 🔴 3. DATABASE_URL В ПЕРЕМЕННЫХ ОКРУЖЕНИЯ

**Проблема:** Строка подключения может содержать пароль в открытом виде

**РЕШЕНИЕ:**

Создайте отдельный файл `.env` для production:

```env
# .env.production (НЕ коммитить!)
DATABASE_URL=postgresql://user:STRONG_PASSWORD_HERE@localhost:5432/timetalk
SECRET_KEY=<64-символьный_ключ>
OPENROUTER_API_KEY=<ваш_ключ>
GOOGLE_CLIENT_ID=<ваш_google_client_id>
```

Используйте secrets management в production (AWS Secrets Manager, HashiCorp Vault, etc.)

---

### 🔴 4. CORS СЛИШКОМ РАЗРЕШАЮЩИЙ

**Файл:** `backend/config/config.py`  
**Проблема:** Разрешены localhost домены для разработки

```python
# ПЛОХО для production
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", 
    "http://localhost:5173,http://localhost:3000,...")
```

**РЕШЕНИЕ:**

```python
# backend/config/config.py
import os

# Режим development или production
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    # В production - только конкретные домены
    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS", 
        ""  # Пустая строка = нет дефолтных значений
    ).split(",")
    
    if not ALLOWED_ORIGINS or ALLOWED_ORIGINS == [""]:
        raise ValueError(
            "❌ ALLOWED_ORIGINS должна быть установлена в production!\n"
            "Пример: ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com"
        )
    
    # Проверяем что нет localhost
    for origin in ALLOWED_ORIGINS:
        if "localhost" in origin or "127.0.0.1" in origin:
            raise ValueError(
                f"❌ localhost не допускается в production CORS: {origin}"
            )
else:
    # В development - localhost разрешен
    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000"
    ).split(",")
```

---

### 🔴 5. ОТСУТСТВИЕ HTTPS ENFORCEMENT

**Проблема:** Нет обязательного HTTPS в production

**РЕШЕНИЕ:**

Добавьте middleware для принудительного HTTPS:

```python
# backend/main.py
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if ENVIRONMENT == "production":
    # Принудительный редирект на HTTPS
    app.add_middleware(HTTPSRedirectMiddleware)
    
    # Также обновите SecurityHeadersMiddleware
    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            response = await call_next(request)
            
            # ... существующие заголовки ...
            
            # ОБЯЗАТЕЛЬНО для production - HSTS
            if ENVIRONMENT == "production":
                response.headers["Strict-Transport-Security"] = \
                    "max-age=31536000; includeSubDomains; preload"
            
            return response
```

Настройте Nginx/Caddy для SSL:

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Редирект HTTP -> HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## ⚠️ ВЫСОКИЙ ПРИОРИТЕТ

### 🟡 6. RATE LIMITING В ПАМЯТИ (НЕ МАСШТАБИРУЕТСЯ)

**Файл:** `backend/core/rate_limiter.py`  
**Проблема:** In-memory rate limiter теряется при рестарте и не работает с несколькими инстансами

```python
# ТЕКУЩАЯ РЕАЛИЗАЦИЯ - не подходит для production
class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)  # ❌ В памяти
```

**РЕШЕНИЕ:**

Используйте Redis для rate limiting:

```python
# backend/core/rate_limiter_redis.py
import redis
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RedisRateLimiter:
    """Production-ready rate limiter с Redis backend"""
    
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        try:
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True
            )
            # Тестируем подключение
            self.redis_client.ping()
            logger.info("✅ Redis rate limiter connected")
        except redis.ConnectionError as e:
            logger.error(f"❌ Redis connection failed: {e}")
            raise
    
    def is_allowed(
        self,
        client_id: str,
        max_requests: int,
        window_seconds: int
    ) -> tuple[bool, int]:
        """
        Проверка rate limit с использованием Redis
        
        Использует sliding window алгоритм для точного подсчета
        """
        key = f"rate_limit:{client_id}"
        now = datetime.utcnow().timestamp()
        window_start = now - window_seconds
        
        try:
            pipe = self.redis_client.pipeline()
            
            # Удаляем старые записи
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Добавляем текущий запрос
            pipe.zadd(key, {str(now): now})
            
            # Считаем количество запросов в окне
            pipe.zcard(key)
            
            # Устанавливаем TTL для автоочистки
            pipe.expire(key, window_seconds + 60)
            
            results = pipe.execute()
            request_count = results[2]
            
            if request_count > max_requests:
                return False, 0
            
            remaining = max_requests - request_count
            return True, remaining
            
        except redis.RedisError as e:
            logger.error(f"Redis error in rate limiter: {e}")
            # Fallback: разрешаем запрос если Redis недоступен
            # Альтернатива: отклонять запросы (более безопасно)
            return True, max_requests
```

**docker-compose.yml:**
```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: timetalk_redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    networks:
      - timetalk_network

volumes:
  redis_data:
    driver: local
```

---

### 🟡 7. ОТСУТСТВИЕ МОНИТОРИНГА И АЛЕРТОВ

**Проблема:** Нет системы оповещения о подозрительной активности

**РЕШЕНИЕ:**

Добавьте Sentry для отслеживания ошибок:

```python
# backend/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

if ENVIRONMENT == "production":
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=ENVIRONMENT,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1,  # 10% трассировки для performance
        profiles_sample_rate=0.1,
        send_default_pii=False,  # ❌ Не отправляем PII данные
        before_send=scrub_sensitive_data,  # Фильтр чувствительных данных
    )

def scrub_sensitive_data(event, hint):
    """Удаляем чувствительные данные перед отправкой в Sentry"""
    # Удаляем пароли, токены и т.д.
    if 'request' in event:
        if 'data' in event['request']:
            data = event['request']['data']
            for key in ['password', 'token', 'api_key', 'secret']:
                if key in data:
                    data[key] = '[FILTERED]'
    return event
```

Добавьте логирование подозрительных действий:

```python
# backend/core/security_logger.py
import logging
from datetime import datetime
from typing import Optional

security_logger = logging.getLogger("security")
security_logger.setLevel(logging.WARNING)

# Отдельный файл для security events
handler = logging.FileHandler("logs/security.log")
formatter = logging.Formatter(
    '%(asctime)s - SECURITY - %(levelname)s - %(message)s'
)
handler.setFormatter(formatter)
security_logger.addHandler(handler)

def log_suspicious_activity(
    event_type: str,
    user_id: Optional[int],
    ip_address: str,
    details: dict
):
    """Логирование подозрительной активности"""
    security_logger.warning(
        f"{event_type} | User: {user_id} | IP: {ip_address} | {details}"
    )

# Примеры использования:

# В rate_limiter.py
if not is_allowed:
    log_suspicious_activity(
        event_type="RATE_LIMIT_EXCEEDED",
        user_id=getattr(request.state, 'user_id', None),
        ip_address=client_id,
        details={"path": path, "limit": max_requests}
    )

# В auth.py
def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        log_suspicious_activity(
            event_type="LOGIN_FAILED_USER_NOT_FOUND",
            user_id=None,
            ip_address=request.client.host,
            details={"email": email}
        )
        return False
    
    if not verify_password(password, user.hashed_password):
        log_suspicious_activity(
            event_type="LOGIN_FAILED_WRONG_PASSWORD",
            user_id=user.id,
            ip_address=request.client.host,
            details={"email": email}
        )
        return False
```

---

### 🟡 8. ОТСУТСТВИЕ ЗАЩИТЫ ОТ BRUTE-FORCE АТАК

**Проблема:** Нет блокировки после множественных неудачных попыток входа

**РЕШЕНИЕ:**

```python
# backend/services/auth_protection_service.py
from datetime import datetime, timedelta
from typing import Optional
import redis
import logging

logger = logging.getLogger(__name__)

class AuthProtectionService:
    """Защита от brute-force атак на authentication"""
    
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        
        # Настройки
        self.max_attempts = 5  # Максимум попыток
        self.lockout_duration = 900  # 15 минут блокировки
        self.attempt_window = 300  # Окно 5 минут
    
    def record_failed_attempt(self, identifier: str) -> dict:
        """
        Записать неудачную попытку входа
        
        Args:
            identifier: email или IP адрес
            
        Returns:
            dict с информацией о блокировке
        """
        key = f"login_attempts:{identifier}"
        lockout_key = f"login_lockout:{identifier}"
        
        # Проверяем, заблокирован ли пользователь
        if self.redis_client.exists(lockout_key):
            ttl = self.redis_client.ttl(lockout_key)
            return {
                "blocked": True,
                "remaining_time": ttl,
                "message": f"Аккаунт временно заблокирован. Повторите через {ttl} секунд."
            }
        
        # Увеличиваем счетчик попыток
        attempts = self.redis_client.incr(key)
        
        # Устанавливаем TTL для окна попыток
        if attempts == 1:
            self.redis_client.expire(key, self.attempt_window)
        
        # Проверяем превышение лимита
        if attempts >= self.max_attempts:
            # Блокируем аккаунт
            self.redis_client.setex(
                lockout_key,
                self.lockout_duration,
                "locked"
            )
            
            # Логируем
            logger.warning(
                f"🔒 Account locked due to too many failed attempts: {identifier}"
            )
            
            return {
                "blocked": True,
                "remaining_time": self.lockout_duration,
                "message": f"Слишком много неудачных попыток. Аккаунт заблокирован на {self.lockout_duration // 60} минут."
            }
        
        return {
            "blocked": False,
            "attempts_remaining": self.max_attempts - attempts
        }
    
    def clear_failed_attempts(self, identifier: str):
        """Очистить счетчик попыток после успешного входа"""
        key = f"login_attempts:{identifier}"
        self.redis_client.delete(key)
    
    def is_blocked(self, identifier: str) -> bool:
        """Проверить, заблокирован ли identifier"""
        lockout_key = f"login_lockout:{identifier}"
        return self.redis_client.exists(lockout_key) > 0

# Использование в backend/api/auth.py
auth_protection = AuthProtectionService()

@router.post("/login", response_model=Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None,
    db: Session = Depends(get_session)
):
    """Вход пользователя с защитой от brute-force"""
    email = form_data.username
    ip_address = request.client.host if request else "unknown"
    
    # Проверяем блокировку по email
    if auth_protection.is_blocked(email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток. Попробуйте позже."
        )
    
    # Проверяем блокировку по IP
    if auth_protection.is_blocked(ip_address):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток. Попробуйте позже."
        )
    
    # Аутентификация
    user = authenticate_user(db, email, form_data.password)
    
    if not user:
        # Записываем неудачную попытку
        result_email = auth_protection.record_failed_attempt(email)
        result_ip = auth_protection.record_failed_attempt(ip_address)
        
        if result_email["blocked"] or result_ip["blocked"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=result_email.get("message") or result_ip.get("message")
            )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Неверный email или пароль. Осталось попыток: {result_email['attempts_remaining']}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Успешный вход - очищаем счетчики
    auth_protection.clear_failed_attempts(email)
    auth_protection.clear_failed_attempts(ip_address)
    
    # ... остальная логика ...
```

---

### 🟡 9. SQL INJECTION (НИЗКИЙ РИСК, НО ПРОВЕРИТЬ)

**Текущая защита:** ✅ SQLModel/SQLAlchemy использует параметризованные запросы

**Проблемные места для проверки:**

```python
# backend/core/database.py - Использование text() с параметрами
# ✅ ПРАВИЛЬНО - параметры безопасны
result = conn.execute(
    text("SELECT * FROM information_schema.columns WHERE table_name = :table_name"),
    {"table_name": table_name}
)

# ❌ ПЛОХО (если где-то есть такое - исправить)
# result = conn.execute(text(f"SELECT * FROM {table_name}"))  # SQL injection!
```

**Рекомендация:** Проверьте весь код на предмет использования f-strings в SQL запросах:

```bash
# Поиск потенциальных SQL injection
grep -r "text(f\"" backend/
grep -r "text(f'" backend/
```

---

### 🟡 10. CSRF PROTECTION

**Проблема:** FastAPI не имеет встроенной CSRF защиты для state-changing операций

**РЕШЕНИЕ:**

Для API с JWT токенами CSRF менее критичен, но рекомендуется добавить:

```python
# backend/core/csrf.py
from fastapi import Request, HTTPException, status
from secrets import token_urlsafe
import logging

logger = logging.getLogger(__name__)

class CSRFProtection:
    """CSRF protection middleware"""
    
    def __init__(self):
        self.header_name = "X-CSRF-Token"
        self.cookie_name = "csrf_token"
    
    def generate_token(self) -> str:
        """Генерация CSRF токена"""
        return token_urlsafe(32)
    
    def validate_token(self, request: Request) -> bool:
        """Валидация CSRF токена"""
        # Пропускаем GET, HEAD, OPTIONS
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return True
        
        # Получаем токен из заголовка
        header_token = request.headers.get(self.header_name)
        
        # Получаем токен из cookie
        cookie_token = request.cookies.get(self.cookie_name)
        
        if not header_token or not cookie_token:
            return False
        
        # Сравниваем токены
        return header_token == cookie_token

csrf_protection = CSRFProtection() 

# Middleware
from starlette.middleware.base import BaseHTTPMiddleware

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Для API эндпоинтов (не для статических файлов)
        if request.url.path.startswith("/api/") or request.url.path.startswith("/auth/"):
            if not csrf_protection.validate_token(request):
                # Только для state-changing операций
                if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
                    logger.warning(f"CSRF validation failed for {request.url.path}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="CSRF validation failed"
                    )
        
        response = await call_next(request)
        
        # Добавляем CSRF токен в cookie
        if not request.cookies.get(csrf_protection.cookie_name):
            csrf_token = csrf_protection.generate_token()
            response.set_cookie(
                key=csrf_protection.cookie_name,
                value=csrf_token,
                httponly=True,
                secure=True,  # Только HTTPS
                samesite="strict"
            )
        
        return response

# В main.py
app.add_middleware(CSRFMiddleware)
```

**Frontend (React) - добавить CSRF токен:**

```javascript
// frontend/src/services/api/client.js
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем CSRF токен к каждому запросу
api.interceptors.request.use((config) => {
  const csrfToken = Cookies.get('csrf_token');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

---

## ⚠️ СРЕДНИЙ ПРИОРИТЕТ

### 🟠 11. ЛОГИРОВАНИЕ ЧУВСТВИТЕЛЬНЫХ ДАННЫХ

**Проблема:** Возможное логирование паролей и токенов

**РЕШЕНИЕ:**

```python
# backend/core/logging_config.py
import logging
import re
from typing import Any

class SensitiveDataFilter(logging.Filter):
    """Фильтр для удаления чувствительных данных из логов"""
    
    SENSITIVE_PATTERNS = [
        (r'password["\']?\s*[:=]\s*["\']?([^"\'}\s]+)', '[FILTERED]'),
        (r'token["\']?\s*[:=]\s*["\']?([^"\'}\s]+)', '[FILTERED]'),
        (r'api[_-]?key["\']?\s*[:=]\s*["\']?([^"\'}\s]+)', '[FILTERED]'),
        (r'secret["\']?\s*[:=]\s*["\']?([^"\'}\s]+)', '[FILTERED]'),
        (r'Bearer\s+([A-Za-z0-9\-._~+/]+)', 'Bearer [FILTERED]'),
    ]
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Фильтрация чувствительных данных"""
        message = record.getMessage()
        
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            message = re.sub(pattern, replacement, message, flags=re.IGNORECASE)
        
        record.msg = message
        record.args = ()
        
        return True

# Применяем фильтр ко всем логгерам
for handler in logging.root.handlers:
    handler.addFilter(SensitiveDataFilter())
```

---

### 🟠 12. EMAIL ВЕРИФИКАЦИЯ

**Файл:** `backend/services/email_service.py`  
**Проверка:** Нужно убедиться что email сервис настроен безопасно

```python
# backend/services/email_service.py - добавить проверки

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL")
        
        # ✅ Проверка настроек
        if ENVIRONMENT == "production":
            if not all([self.smtp_host, self.smtp_user, self.smtp_password]):
                raise ValueError("Email service not configured for production!")
        
        # ✅ Используем TLS
        self.use_tls = True
    
    def send_email(self, to_email: str, subject: str, body: str):
        """Отправка email с защитой"""
        # ✅ Валидация email
        if not self._validate_email(to_email):
            raise ValueError(f"Invalid email address: {to_email}")
        
        # ✅ Rate limiting для email (защита от спама)
        if not self._check_email_rate_limit(to_email):
            raise ValueError("Email rate limit exceeded")
        
        # ... отправка email ...
    
    def _validate_email(self, email: str) -> bool:
        """Валидация email адреса"""
        from email_validator import validate_email, EmailNotValidError
        try:
            validate_email(email)
            return True
        except EmailNotValidError:
            return False
    
    def _check_email_rate_limit(self, email: str) -> bool:
        """Rate limiting для отправки email"""
        # Максимум 3 письма в час на один email
        key = f"email_rate:{email}"
        redis_client = ...  # Redis client
        
        count = redis_client.get(key) or 0
        if int(count) >= 3:
            return False
        
        redis_client.incr(key)
        redis_client.expire(key, 3600)  # 1 час
        return True
```

---

### 🟠 13. FILE UPLOAD SECURITY (ХОРОШО, НО МОЖНО УЛУЧШИТЬ)

**Текущая реализация:** ✅ Хорошая валидация файлов

**Дополнительные улучшения:**

```python
# backend/services/file_validation_service.py - дополнения

class FileValidationService:
    # ... существующий код ...
    
    def validate_file_content(self, file: UploadFile) -> Tuple[bool, Optional[str]]:
        """
        Валидация содержимого файла (magic bytes)
        
        Защита от подмены расширения файла
        """
        import magic  # python-magic
        
        file.file.seek(0)
        file_content = file.file.read(1024)  # Читаем первые 1KB
        file.file.seek(0)
        
        # Определяем реальный тип файла по magic bytes
        mime = magic.from_buffer(file_content, mime=True)
        
        # Проверяем соответствие расширения и MIME типа
        filename = file.filename or ""
        _, ext = os.path.splitext(filename.lower())
        
        # Маппинг расширений к допустимым MIME типам
        allowed_mimes = {
            ".pdf": ["application/pdf"],
            ".png": ["image/png"],
            ".jpg": ["image/jpeg"],
            ".jpeg": ["image/jpeg"],
            ".docx": [
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/zip"  # DOCX это ZIP архив
            ],
            # ... другие типы ...
        }
        
        if ext in allowed_mimes:
            if mime not in allowed_mimes[ext]:
                return False, f"File content ({mime}) doesn't match extension ({ext})"
        
        return True, None
    
    def scan_for_malicious_content(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """
        Дополнительное сканирование на вредоносный контент
        
        - Проверка на ZIP bombs (для архивов)
        - Проверка на XXE атаки (для XML/DOCX)
        - Проверка на macro viruses (для Office файлов)
        """
        import zipfile
        
        # Защита от ZIP bomb
        if file_path.endswith(('.zip', '.docx', '.xlsx')):
            try:
                with zipfile.ZipFile(file_path, 'r') as zf:
                    # Проверяем размер несжатых данных
                    total_size = sum(info.file_size for info in zf.infolist())
                    
                    # Максимум 100MB несжатых данных
                    if total_size > 100 * 1024 * 1024:
                        return False, "Suspicious compressed file (potential ZIP bomb)"
                    
                    # Проверяем коэффициент сжатия
                    compressed_size = sum(info.compress_size for info in zf.infolist())
                    if compressed_size > 0:
                        ratio = total_size / compressed_size
                        if ratio > 100:  # Слишком высокий коэффициент
                            return False, "Suspicious compression ratio"
            except Exception as e:
                return False, f"Error checking archive: {str(e)}"
        
        return True, None
```

---

### 🟠 14. DEPENDENCY VULNERABILITIES

**Файл:** `backend/requirements.txt`

**РЕШЕНИЕ:**

Регулярно проверяйте зависимости на уязвимости:

```bash
# Установите safety
pip install safety

# Проверка зависимостей
safety check --file backend/requirements.txt

# Или используйте pip-audit
pip install pip-audit
pip-audit -r backend/requirements.txt
```

**Автоматизация:** Добавьте GitHub Actions для автоматической проверки:

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 0 * * 0'  # Еженедельно

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install safety pip-audit
          pip install -r backend/requirements.txt
      
      - name: Run Safety check
        run: safety check --json
      
      - name: Run pip-audit
        run: pip-audit -r backend/requirements.txt
```

---

## 🟢 НИЗКИЙ ПРИОРИТЕТ

### 15. УЛУЧШЕНИЕ CSP (Content Security Policy)

**Текущая CSP:** Разрешает `unsafe-inline` и `unsafe-eval`

```python
# backend/core/security.py - текущая CSP
csp = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "  # ⚠️ Небезопасно
    "style-src 'self' 'unsafe-inline'; "
    # ...
)
```

**Улучшенная CSP для production:**

```python
# backend/core/security.py
from config import ENVIRONMENT

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # ... другие заголовки ...
        
        # CSP зависит от окружения
        if ENVIRONMENT == "production":
            # Строгая CSP для production
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'nonce-{nonce}'; "  # Используем nonce
                "style-src 'self' 'nonce-{nonce}'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self' https://api.openrouter.ai; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self';"
            )
        else:
            # Более мягкая CSP для development
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                # ... остальное ...
            )
        
        response.headers["Content-Security-Policy"] = csp
        return response
```

**Frontend - использование nonce:**

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // CSP nonce plugin
    {
      name: 'csp-nonce',
      transformIndexHtml(html) {
        const nonce = generateNonce();
        return html.replace(
          /<script/g,
          `<script nonce="${nonce}"`
        ).replace(
          /<style/g,
          `<style nonce="${nonce}"`
        );
      }
    }
  ]
});
```

---

### 16. SECURITY HEADERS - ДОПОЛНИТЕЛЬНО

**Добавить дополнительные заголовки:**

```python
# backend/core/security.py
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Существующие заголовки
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # 🆕 Дополнительные заголовки
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["X-Download-Options"] = "noopen"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        
        # Cache control для API
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response
```

---

### 17. DATABASE BACKUPS

**Проблема:** Нет автоматических бэкапов

**РЕШЕНИЕ:**

Создайте скрипт для автоматического бэкапа:

```bash
#!/bin/bash
# scripts/backup_database.sh

set -e

# Конфигурация
BACKUP_DIR="/backups/postgresql"
DB_NAME="timetalk"
DB_USER="timetalk_user"
DB_HOST="localhost"
DB_PORT="5432"
RETENTION_DAYS=7  # Хранить бэкапы 7 дней

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"

# Имя файла с датой
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

# Выполняем бэкап
echo "🔄 Starting database backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"

# Удаляем старые бэкапы
echo "🧹 Cleaning old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Проверяем размер бэкапа
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📊 Backup size: $BACKUP_SIZE"

# Опционально: загрузка в S3/облачное хранилище
# aws s3 cp "$BACKUP_FILE" "s3://your-bucket/backups/"
```

**Cron job для ежедневного бэкапа:**

```bash
# Добавить в crontab
# crontab -e

# Бэкап каждый день в 2:00 ночи
0 2 * * * /path/to/scripts/backup_database.sh >> /var/log/db_backup.log 2>&1
```

**Реализовано:** скрипт `scripts/backup_database.sh` и инструкция в `backend/scripts/README-DB.md`.

---

### 18. PGADMIN В PRODUCTION

**Проблема:** pgAdmin открыт в production (порт 5050)

**РЕШЕНИЕ:**

```yaml
# docker-compose.yml
services:
  pgadmin:
    # ❌ НЕ запускать pgAdmin в production!
    # Закомментировать или удалить для production
    profiles:
      - development  # Запускать только с --profile development
    image: dpage/pgadmin4:latest
    # ... остальная конфигурация ...
```

Запуск только в development:

```bash
# Development (с pgAdmin)
docker-compose --profile development up

# Production (без pgAdmin)
docker-compose up
```

**Альтернатива:** Если нужен pgAdmin в production:

1. Закрыть от внешнего доступа (только localhost)
2. Добавить VPN или SSH туннель
3. Включить HTTPS
4. Сменить дефолтный пароль на сильный

---

## ✅ ПОЛОЖИТЕЛЬНЫЕ АСПЕКТЫ

### Что уже сделано хорошо:

1. ✅ **Хеширование паролей**: bcrypt_sha256 с автоматической миграцией
2. ✅ **JWT токены**: Правильная реализация с expiration
3. ✅ **Валидация ввода**: Санитизация и валидация пользовательского ввода
4. ✅ **Path traversal защита**: Проверка файловых путей
5. ✅ **Rate limiting**: Базовая реализация (но требует Redis)
6. ✅ **Security headers**: Большинство важных заголовков присутствуют
7. ✅ **File validation**: Whitelist расширений, проверка размера
8. ✅ **Virus scanning**: Интеграция ClamAV и VirusTotal
9. ✅ **CORS**: Настраиваемые allowed origins
10. ✅ **Timing attack protection**: Constant-time compare для паролей
11. ✅ **SQL injection защита**: Использование ORM (SQLModel)
12. ✅ **Password validation**: Требования к сложности пароля
13. ✅ **Error handling**: Глобальные обработчики ошибок
14. ✅ **Access control**: Проверка владельца файлов перед доступом
15. ✅ **Google OAuth**: Безопасная интеграция

---

## 📋 ЧЕКЛИСТ ПЕРЕД PRODUCTION DEPLOY

### Обязательно выполнить:

- [ ] **Сменить все пароли и секреты**
  - [ ] `SECRET_KEY` - генерировать 64-символьный ключ
  - [ ] `DATABASE_URL` - сильный пароль БД
  - [ ] `PGADMIN_PASSWORD` - или удалить pgAdmin
  - [ ] `OPENROUTER_API_KEY` - проверить безопасное хранение

- [ ] **Настроить переменные окружения**
  - [ ] Скопировать `env.example` в `.env` в корне проекта (для docker-compose) и задать пароли
  - [ ] Создать `backend/.env` с реальными секретами (SECRET_KEY, DATABASE_URL и т.д.)
  - [ ] Добавить `.env*` в `.gitignore`
  - [ ] Проверить что секреты не в Git истории

- [ ] **Настроить HTTPS**
  - [ ] Получить SSL сертификат (Let's Encrypt)
  - [ ] Настроить Nginx/Caddy для HTTPS
  - [ ] Включить `HTTPSRedirectMiddleware`
  - [ ] Добавить HSTS заголовок

- [ ] **Ограничить CORS**
  - [ ] `ALLOWED_ORIGINS` - только production домены
  - [ ] Проверить что нет `localhost` в списке
  - [ ] Установить `ENVIRONMENT=production`

- [ ] **Настроить Redis**
  - [ ] Развернуть Redis для rate limiting
  - [ ] Обновить `RateLimiter` для использования Redis
  - [ ] Настроить `REDIS_URL` в `.env`

- [ ] **Защита от brute-force**
  - [ ] Внедрить `AuthProtectionService`
  - [ ] Настроить блокировку после 5 попыток
  - [ ] Тестировать блокировку

- [ ] **Логирование и мониторинг**
  - [ ] Настроить Sentry или аналог
  - [ ] Добавить `SensitiveDataFilter` к логам
  - [ ] Настроить security.log файл
  - [ ] Настроить алерты для критических событий

- [ ] **Безопасность БД**
  - [ ] Включить SSL для PostgreSQL подключений
  - [ ] Ограничить доступ к БД по IP (firewall)
  - [ ] Настроить автоматические бэкапы — **скрипт:** `scripts/backup_database.sh`, см. `backend/scripts/README-DB.md`

- [ ] **Сканирование уязвимостей**
  - [ ] Запустить проверку: `pip install pip-audit && python backend/scripts/check_vulnerabilities.py` или `./scripts/check_vulnerabilities.sh`
  - [ ] Опционально: `safety check`
  - [ ] Обновить устаревшие пакеты
  - [ ] Настроить GitHub Actions для автоматических проверок

- [ ] **Firewall и сеть**
  - [ ] Закрыть ненужные порты (оставить только 80, 443)
  - [ ] Настроить firewall (UFW или аналог)
  - [ ] Ограничить SSH доступ
  - [ ] Отключить pgAdmin или защитить VPN

- [ ] **Тестирование безопасности**
  - [ ] Penetration testing (базовый)
  - [ ] Тестирование rate limiting
  - [ ] Тестирование brute-force защиты
  - [ ] Проверка HTTPS и certificate

### Рекомендуется:

- [ ] Настроить WAF (Web Application Firewall)
- [ ] Включить 2FA для админ-аккаунтов
- [ ] Настроить IDS/IPS систему
- [ ] Регулярные security audits
- [ ] Disaster recovery план
- [ ] Документация security процедур

---

## ✅ СТАТУС ПРОВЕРКИ (что выполнено в коде / что осталось вам)

### В коде уже есть (проверено):

| Пункт | Где проверено |
|-------|----------------|
| Секреты из .env (docker-compose) | `docker-compose.yml`: `${DB_PASSWORD}`, `${PGADMIN_PASSWORD}` и т.д. |
| Секреты backend (SECRET_KEY, DATABASE_URL, ALLOWED_ORIGINS) | `config/config.py`: без дефолтов в production, проверки при старте |
| Redis в инфраструктуре | `docker-compose.yml`: сервис `redis` |
| Rate limiting через Redis | `core/rate_limiter.py`: Redis + in-memory fallback |
| Защита от brute-force | `api/auth.py`: `auth_protection_service.is_blocked`, `record_failed_attempt`, `clear_attempts` |
| JWT в HttpOnly cookie | `api/auth.py`: `set_cookie("access_token", ...)`, `delete_cookie`; `dependencies.py`: чтение из cookie |
| CSRF | `main.py`: `CSRFMiddleware`; фронт: `client.js` — `X-CSRF-Token`, `getCsrfToken()` |
| Security headers + CSP | `core/security.py`: X-Content-Type-Options, CSP, HSTS при HTTPS |
| Редирект HTTP→HTTPS в production | `main.py`: `HTTPSRedirectMiddleware` при `ENVIRONMENT == "production"` |
| pgAdmin только в dev | `docker-compose.yml`: `profiles: [development]` у сервиса pgadmin |
| Фильтр чувствительных данных в логах | `core/logging_config.py`: `SensitiveDataFilter`, вызов в `main.py` |
| Отдельный security.log | `core/security_logger.py`, вызовы из auth и rate_limiter |
| В production не отдаём детали 422/500 | `main.py`: в production только общие сообщения, без `exc.errors()` и текста исключения |
| Параметризованный SQL | `core/database.py`: `get_column_names` через `:table_name` |
| Бэкап-скрипт | `scripts/backup_database.sh` |
| Скрипт проверки зависимостей | `scripts/check_vulnerabilities.sh`, `backend/scripts/check_vulnerabilities.py` |
| Шаблон переменных для Docker | `env.example` в корне |
| .env не коммитится | `.gitignore`: `.env`, `.env.local`, `*.log`, `logs/` |

### Вам нужно сделать (не в коде):

| Пункт | Действие |
|-------|----------|
| Переменные | Создать `backend/.env` с реальными `ENVIRONMENT=production`, `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`. В корне: скопировать `env.example` → `.env` и подставить пароли. |
| HTTPS | Получить сертификат (Let's Encrypt и т.п.) и настроить Nginx/Caddy перед приложением. |
| Проверка зависимостей | Один раз выполнить: `pip install pip-audit && python backend/scripts/check_vulnerabilities.py`. |
| Бэкапы | Настроить cron для `scripts/backup_database.sh` (см. `backend/scripts/README-DB.md`). |
| Сервер | Запускать без `--profile development`, чтобы не поднимать pgAdmin. |

---

## 🚀 ПРИОРИТИЗАЦИЯ ЗАДАЧ

### Уже реализовано в коде (ничего настраивать не нужно):

- Секреты из переменных окружения (docker-compose и backend)
- Redis для rate limiting и защиты от brute-force
- Защита от brute-force (блокировка по email и IP)
- CSRF, JWT в HttpOnly cookie, security headers, CSP
- pgAdmin только в профиле `development`
- Фильтр чувствительных данных в логах, отдельный security.log
- В production не отдаются детали ошибок (422/500)

### Реально сделать перед выкладкой:

1. **Переменные** — в `backend/.env`: `ENVIRONMENT=production`, сильный `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS=https://ваш-домен`. В корне: скопировать `env.example` → `.env` для docker-compose.
2. **HTTPS** — сертификат и Nginx/Caddy перед приложением.
3. **Проверка зависимостей** — один раз: `python backend/scripts/check_vulnerabilities.py`.
4. **Бэкапы** — cron для `scripts/backup_database.sh` (см. `backend/scripts/README-DB.md`).
5. **На сервере** — не использовать `--profile development` (чтобы не поднимать pgAdmin).

### По желанию (не обязательно для старта):

- Sentry (`SENTRY_DSN`), firewall, SSL для подключения к БД, регулярный запуск pip-audit в CI.

---

## 📞 ПОДДЕРЖКА

Если возникнут вопросы по реализации любой из рекомендаций, обращайтесь.

**Важно:** Безопасность - это не разовая задача, а постоянный процесс. Регулярно проверяйте:
- Обновления зависимостей
- Security advisories
- Логи на подозрительную активность
- Новые уязвимости в используемых технологиях

---

**Удачи с безопасным запуском! 🔐**
