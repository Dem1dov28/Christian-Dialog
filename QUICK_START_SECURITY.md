# 🚀 БЫСТРЫЙ СТАРТ: Подготовка к Production

## ⏱️ 30 минут до безопасного deploy

Это краткое руководство по подготовке приложения к production deployment.
Полная документация: `SECURITY_AUDIT.md`

---

## 1️⃣ ГЕНЕРАЦИЯ СЕКРЕТОВ (5 минут)

### Сгенерируйте SECRET_KEY

```bash
# В терминале выполните:
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"
```

Скопируйте результат и сохраните в безопасном месте.

### Сгенерируйте пароли БД

```bash
# Пароль для PostgreSQL
python -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(32))"

# Пароль для pgAdmin (если используется)
python -c "import secrets; print('PGADMIN_PASSWORD=' + secrets.token_urlsafe(32))"
```

---

## 2️⃣ СОЗДАНИЕ .ENV ФАЙЛОВ (10 минут)

### Backend .env файл

Создайте `backend/.env`:

```bash
# КРИТИЧЕСКИ ВАЖНО - PRODUCTION
ENVIRONMENT=production
SECRET_KEY=<ваш_сгенерированный_ключ_64_символа>
DATABASE_URL=postgresql://timetalk_user:<сильный_пароль>@localhost:5432/timetalk

# CORS - только ваши домены!
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Redis для rate limiting
REDIS_URL=redis://localhost:6379/0

# API ключи
OPENROUTER_API_KEY=<ваш_ключ>
GOOGLE_CLIENT_ID=<ваш_production_client_id>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASSWORD=<app-specific-password>
FROM_EMAIL=noreply@yourdomain.com

# ClamAV
CLAMAV_HOST=localhost
CLAMAV_PORT=3310

# Мониторинг (опционально)
SENTRY_DSN=<ваш_sentry_dsn>

# Отключить DEBUG
DEBUG=False
LOG_LEVEL=INFO
```

### Frontend .env файл

Создайте `frontend/.env.production`:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_GOOGLE_CLIENT_ID=<ваш_production_client_id>
VITE_ENVIRONMENT=production
```

---

## 3️⃣ ОБНОВЛЕНИЕ DOCKER-COMPOSE (5 минут)

Замените захардкоженные пароли на переменные:

```yaml
# docker-compose.yml
services:
  postgresql:
    environment:
      POSTGRES_DB: ${DB_NAME:-timetalk}
      POSTGRES_USER: ${DB_USER:-timetalk_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # ИЗ .ENV!
      
  redis:  # ДОБАВИТЬ Redis
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
  redis_data:  # ДОБАВИТЬ volume
    driver: local
```

Создайте `.env` в корне проекта:

```bash
DB_NAME=timetalk
DB_USER=timetalk_user
DB_PASSWORD=<ваш_сгенерированный_пароль>
PGADMIN_PASSWORD=<ваш_сгенерированный_пароль>
PGADMIN_EMAIL=admin@yourdomain.com
```

---

## 4️⃣ НАСТРОЙКА RATE LIMITING С REDIS (3 минуты)

Обновите `backend/core/rate_limiter.py`:

```python
# В начале файла добавьте:
import redis
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    USE_REDIS = True
    logger.info("✅ Redis connected for rate limiting")
except Exception as e:
    USE_REDIS = False
    logger.warning(f"⚠️ Redis unavailable, using in-memory rate limiting: {e}")

# Используйте redis_client в RateLimiter...
```

---

## 5️⃣ НАСТРОЙКА NGINX + SSL (7 минут)

### Установка Certbot для Let's Encrypt

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

### Получение SSL сертификата

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Nginx конфигурация

Создайте `/etc/nginx/sites-available/epochal-dialog`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL сертификаты (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend (React)
    location / {
        root /var/www/epochal-dialog/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /auth/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/epochal-dialog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6️⃣ ПРОВЕРКА БЕЗОПАСНОСТИ (ПЕРЕД DEPLOY!)

### Автоматическая проверка

```bash
# Запустите скрипт проверки безопасности
python check_security.py
```

### Ручная проверка

```bash
# 1. Проверьте что .env НЕ в Git
git ls-files | grep ".env"
# Должно быть пусто!

# 2. Проверьте зависимости
cd backend
pip install safety
safety check --file requirements.txt

cd ../frontend
npm audit

# 3. Проверьте переменные окружения
grep -r "localhost" backend/config/
# В production не должно быть localhost!

# 4. Убедитесь что DEBUG=False
grep "DEBUG" backend/.env
```

---

## ✅ ЧЕКЛИСТ ПЕРЕД DEPLOY

Убедитесь что:

- [ ] SECRET_KEY сгенерирован (64+ символа) и уникален
- [ ] Все пароли изменены с дефолтных значений
- [ ] `.env` файлы НЕ в Git (проверьте `.gitignore`)
- [ ] `ALLOWED_ORIGINS` содержит только production домены
- [ ] `ENVIRONMENT=production` в `backend/.env`
- [ ] `DEBUG=False` в `backend/.env`
- [ ] Redis запущен и настроен для rate limiting
- [ ] SSL сертификат установлен и работает
- [ ] Nginx настроен и проксирует запросы
- [ ] `check_security.py` запущен без критических ошибок
- [ ] Frontend собран для production: `npm run build`
- [ ] Бэкапы БД настроены (cron job)
- [ ] Мониторинг ошибок настроен (Sentry или аналог)
- [ ] pgAdmin отключен или защищен VPN
- [ ] Firewall настроен (открыты только 80, 443, 22)

---

## 🚀 DEPLOY

### 1. Соберите Frontend

```bash
cd frontend
npm run build
```

### 2. Разверните файлы на сервер

```bash
# Скопируйте frontend build
scp -r frontend/dist/* user@server:/var/www/epochal-dialog/frontend/

# Скопируйте backend
scp -r backend/* user@server:/var/www/epochal-dialog/backend/
```

### 3. Запустите сервисы

```bash
# На сервере
cd /var/www/epochal-dialog

# Запустите Docker services
docker-compose up -d postgresql redis

# Запустите backend (через systemd или supervisor)
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4. Настройте systemd service

Создайте `/etc/systemd/system/epochal-dialog.service`:

```ini
[Unit]
Description=Epochal Dialog Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/epochal-dialog/backend
Environment="PATH=/var/www/epochal-dialog/venv/bin"
ExecStart=/var/www/epochal-dialog/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable epochal-dialog
sudo systemctl start epochal-dialog
sudo systemctl status epochal-dialog
```

---

## 🔍 МОНИТОРИНГ

### Логи

```bash
# Backend логи
sudo journalctl -u epochal-dialog -f

# Nginx логи
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Docker логи
docker-compose logs -f postgresql
docker-compose logs -f redis
```

### Проверка здоровья

```bash
# API health check
curl https://yourdomain.com/api

# SSL check
curl -I https://yourdomain.com

# Security headers check
curl -I https://yourdomain.com | grep -i "security\|x-"
```

---

## ⚠️ ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК

### Откат назад

```bash
# Остановите сервисы
sudo systemctl stop epochal-dialog
docker-compose down

# Восстановите БД из бэкапа
gunzip < /backups/postgresql/backup_latest.sql.gz | psql -U timetalk_user -d timetalk
```

### Проверка безопасности после deploy

```bash
# SSL test
curl -I https://yourdomain.com | grep -i strict-transport

# Rate limiting test
for i in {1..100}; do curl https://yourdomain.com/api/test; done

# CORS test
curl -H "Origin: https://evil.com" https://yourdomain.com/api
# Должно быть заблокировано
```

---

## 📞 ПОДДЕРЖКА

Если возникли вопросы:

1. Проверьте полную документацию: `SECURITY_AUDIT.md`
2. Проверьте логи: `sudo journalctl -u epochal-dialog -f`
3. Запустите проверку безопасности: `python check_security.py`

---

**Удачного deployment! 🚀**
