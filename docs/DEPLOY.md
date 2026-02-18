# Запуск Epochal Dialog на сервере

Инструкция по развёртыванию проекта на VPS/сервере с помощью Docker Compose.

## Требования

- **Сервер**: Linux (Ubuntu 22.04, Debian 12 или аналог)
- **Docker** 24+ и **Docker Compose** v2
- Домен (желательно с SSL, например Let's Encrypt)

Установка Docker на Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# выйти и зайти снова или: newgrp docker
```

---

## 1. Клонирование и настройка

```bash
git clone <url-репозитория> "Epochal Dialog"
cd "Epochal Dialog"
```

Создайте файл `.env` в **корне проекта** (рядом с `docker-compose.yml`):

```bash
cp .env.example .env
nano .env   # или любой редактор
```

Обязательно задайте:

| Переменная | Описание |
|------------|----------|
| `DB_PASSWORD` | Надёжный пароль для PostgreSQL |
| `SECRET_KEY` | Случайная строка 32+ символов: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `ALLOWED_ORIGINS` | Ваш домен для фронта, например `https://app.example.com` |
| `OPENROUTER_API_KEY` | Ключ API OpenRouter |
| `VITE_API_BASE_URL` | URL, по которому браузер будет обращаться к API (см. ниже) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID (если используете вход через Google) |

**Кука и вход через Google (фронт и API с разных доменов):** в production кука ставится с `SameSite=None` и `Secure=True`, чтобы браузер отправлял её при запросах с другого домена. Для этого **API должен быть доступен по HTTPS** (например, через nginx с SSL). Задайте `VITE_API_BASE_URL=https://...` (не `http://`). Если API только по HTTP, задайте `COOKIE_SECURE=false` и `COOKIE_SAMESITE=lax` — тогда кука будет работать только при фронте и API с одного домена/порта.

**Важно про `VITE_API_BASE_URL`:**

- Если фронт и API будут доступны с **одного домена** через reverse proxy (рекомендуется): укажите базовый URL этого домена, например `https://app.example.com`. Тогда запросы к API пойдут на тот же домен (например `/api/...`), и nginx будет проксировать их на backend.
- Если API на **отдельном поддомене** (например `https://api.example.com`): укажите `VITE_API_BASE_URL=https://api.example.com`.

В production **не** используйте `DEBUG=True` и не оставляйте `ALLOWED_ORIGINS` с localhost.

**Почта (коды верификации):** если на VPS заблокирован SMTP, задайте в `.env` отправку через Resend (HTTPS):

| Переменная | Описание |
|------------|----------|
| `RESEND_API_KEY` | Ключ из [resend.com](https://resend.com) → API Keys → Create API Key |
| `RESEND_FROM` | Адрес отправителя с подтверждённого домена, например `noreply@epochaldialog.com` (пусто = тестовый onboarding@resend.dev) |
| `RESEND_REPLY_TO` | Куда слать ответы пользователей, например `sentiensapps@gmail.com` |

---

## 2. Запуск всех сервисов

Из корня проекта:

```bash
docker compose up -d --build
```

Будут запущены:

- **postgresql** — база данных (порт 5432)
- **redis** — кеш и rate limiting (порт 6379)
- **backend** — FastAPI (порт 8000)
- **frontend** — SPA за nginx (порт 80)

Проверка:

```bash
docker compose ps
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:80
```

Фронт: `http://IP_СЕРВЕРА`  
API: `http://IP_СЕРВЕРА:8000`  
Документация API: `http://IP_СЕРВЕРА:8000/docs`

---

## 3. Reverse proxy и HTTPS (рекомендуется)

### Быстрый вариант: один домен epochaldialog.com (уже есть сертификат)

Если вы уже получили сертификат Certbot для `epochaldialog.com` (см. выше), сделайте так.

1. **Установить Nginx на сервере**
   ```bash
   apt install -y nginx
   ```

2. **Освободить порт 80 для Nginx** — в `docker-compose.yml` сменить порт фронта:
   - Было: `ports: - "80:80"` у сервиса `frontend`
   - Стало: `ports: - "8080:80"` (фронт будет на 8080, Nginx займёт 80 и 443)

3. **Скопировать конфиг и включить сайт**
   ```bash
   cp "/root/Epochal Dialog/docs/nginx-epochaldialog-https.conf" /etc/nginx/sites-available/epochaldialog.com
   ln -sf /etc/nginx/sites-available/epochaldialog.com /etc/nginx/sites-enabled/
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```

4. **В `.env` на сервере**
   - `VITE_API_BASE_URL=https://epochaldialog.com`
   - `ALLOWED_ORIGINS=https://epochaldialog.com`

5. **Пересобрать фронт и перезапустить**
   ```bash
   cd "/root/Epochal Dialog"
   docker compose up -d --build frontend
   ```

После этого сайт будет по `https://epochaldialog.com`, API — по тому же домену (куки и вход через Google будут работать).

---

Чтобы отдавать приложение по одному домену и включить HTTPS, поставьте на хост **Nginx** (или Caddy) и проксируйте запросы в контейнеры.

### Вариант A: Два домена (рекомендуется) — фронт и API на поддоменах

- Фронт: `https://app.example.com` → контейнер frontend (порт 80)
- API: `https://api.example.com` → контейнер backend (порт 8000)

**Nginx — фронт** (`/etc/nginx/sites-available/app.example.com`):

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Nginx — API** (`/etc/nginx/sites-available/api.example.com`):

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

В `.env`:

- `VITE_API_BASE_URL=https://api.example.com`
- `ALLOWED_ORIGINS=https://app.example.com`

### Вариант B: Один домен (фронт и API на одном домене)

Если хотите отдавать и фронт, и API с одного домена (например `app.example.com`), нужно проксировать на backend пути вроде `/auth`, `/chat`, `/agents`, `/api`, `/static`, `/docs` и т.д. Пример одного блока для API (остальные запросы — на фронт):

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;
    # ... ssl_* ...

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/(auth|chat|agents|folders|search|static|api|docs|openapi|health|reports|support|payments) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

В `.env`: `VITE_API_BASE_URL=https://app.example.com`, `ALLOWED_ORIGINS=https://app.example.com`.

После правок: `sudo nginx -t && sudo systemctl reload nginx`.

---

## 4. Только инфраструктура (БД + Redis)

Если backend и frontend вы запускаете вручную (без Docker):

```bash
docker compose up -d postgresql redis
```

В `backend/.env` укажите:

- `DATABASE_URL=postgresql://timetalk_user:YOUR_DB_PASSWORD@localhost:5432/timetalk`
- `REDIS_URL=redis://localhost:6379/0`

Переменные `DB_USER`, `DB_PASSWORD`, `DB_NAME` должны совпадать с теми, что заданы в корневом `.env` для docker-compose.

---

## 5. Обновление и перезапуск

```bash
git pull
docker compose up -d --build
```

Пересборка фронта потребуется при изменении `VITE_API_BASE_URL` или `VITE_GOOGLE_CLIENT_ID` (они задаются при сборке образа).

---

## 6. Логи и отладка

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

Перезапуск одного сервиса:

```bash
docker compose restart backend
```

---

## 7. Резервное копирование БД

```bash
docker compose exec postgresql pg_dump -U timetalk_user timetalk > backup_$(date +%Y%m%d).sql
```

Восстановление:

```bash
docker compose exec -T postgresql psql -U timetalk_user timetalk < backup_20250214.sql
```

(подставьте нужное имя файла и пользователя/БД при необходимости.)

---

## Краткий чеклист перед production

- [ ] В `.env`: уникальный `SECRET_KEY`, сильный `DB_PASSWORD`
- [ ] `ENVIRONMENT=production`, `DEBUG=False`
- [ ] `ALLOWED_ORIGINS` только с вашим доменом (без localhost)
- [ ] `VITE_API_BASE_URL` и фактическая схема доступа к API совпадают (один домен или api-поддомен)
- [ ] Настроен HTTPS и reverse proxy
- [ ] Настроены бэкапы PostgreSQL

После выполнения этих шагов проект готов к работе на сервере.
