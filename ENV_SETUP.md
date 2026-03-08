# Настройка .env — подробная инструкция

Скопируйте `.env.example` в `.env` и заполните значения. Файл `.env` не коммитится в репозиторий.

---

## Обязательные переменные

### SECRET_KEY
**Назначение:** Секрет для подписи JWT-токенов и сессий.

**Где взять:** Сгенерируйте сами:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Пример:** `SECRET_KEY=aB3dE5fG7hI9jK2lM4nO6pQ8rS0tU1vW3xY5zA7bC9dE1fG3hI5jK7lM9nO1pQ3rS5tU7vW9xY1zA3`

---

### DATABASE_URL
**Назначение:** Строка подключения к PostgreSQL.

**Где взять:** Собственный сервер PostgreSQL или облачный (Supabase, Railway, Neon и т.п.).

**Формат:** `postgresql://ПОЛЬЗОВАТЕЛЬ:ПАРОЛЬ@ХОСТ:ПОРТ/ИМЯ_БД`

**Пример локально:**
```
DATABASE_URL=postgresql://timetalk_user:mypassword@localhost:5432/timetalk
```

---

### OPENROUTER_API_KEY
**Назначение:** Ключ API OpenRouter для LLM (GPT, Claude и др.).

**Где взять:** https://openrouter.ai/keys  
Зарегистрируйтесь → Create API Key.

**Пример:** `OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx`

---

### GOOGLE_CLIENT_ID и VITE_GOOGLE_CLIENT_ID
**Назначение:** OAuth 2.0 Client ID для «Войти через Google».

**Где взять:**
1. https://console.cloud.google.com/
2. Создайте проект (или выберите существующий)
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
4. Application type: Web application
5. Authorized JavaScript origins: `http://localhost:5173`, `https://ваш-домен.com`
6. Authorized redirect URIs: `http://localhost:5173`, `https://ваш-домен.com`
7. Скопируйте Client ID

**Пример:** `GOOGLE_CLIENT_ID=597665433518-xxx.apps.googleusercontent.com`  
То же значение в `VITE_GOOGLE_CLIENT_ID`.

---

## Telegram

### TELEGRAM_BOT_TOKEN
**Назначение:** Токен бота для Mini App (проверка initData) и оплаты Stars.

**Где взять:**
1. Откройте https://t.me/BotFather
2. `/newbot` или `/mybots` → выбрать бота → API Token
3. Скопируйте токен (формат `123456789:ABCdefGHI...`)

**Пример:** `TELEGRAM_BOT_TOKEN=7123456789:AAHabcdefghijklmnop`

---

### TELEGRAM_OIDC_CLIENT_ID
**Назначение:** Client ID для кнопки «Войти через Telegram» на обычном сайте.

**Где взять:**
1. https://t.me/BotFather → выбрать вашего бота
2. Bot Settings → **Web Login**
3. Add Allowed URLs: `https://ваш-сайт.com`, `https://ваш-сайт.com/auth/telegram-callback`
4. Скопируйте **Client ID** (число)

**Пример:** `TELEGRAM_OIDC_CLIENT_ID=7123456789`

---

### TELEGRAM_OIDC_CLIENT_SECRET
**Назначение:** Секрет для OIDC-входа через Telegram.

**Где взять:** В том же разделе Web Login в BotFather, рядом с Client ID.

**Пример:** `TELEGRAM_OIDC_CLIENT_SECRET=abcdef1234567890...`

---

### TELEGRAM_OIDC_REDIRECT_URI
**Назначение:** URL, на который Telegram вернёт пользователя после авторизации.

**Где взять:** Укажите свой — это URL фронтенда + `/auth/telegram-callback`.  
Должен совпадать с Allowed URL в BotFather.

**Примеры:**
- Локально: `TELEGRAM_OIDC_REDIRECT_URI=http://localhost:5173/auth/telegram-callback`
- Продакшен: `TELEGRAM_OIDC_REDIRECT_URI=https://epochaldialog.com/auth/telegram-callback`

---

### TELEGRAM_STARS_PRICE_PLUS и TELEGRAM_STARS_PRICE_PRO
**Назначение:** Цены тарифов в Telegram Stars (оплата в Mini App).

**Где взять:** Задаёте сами. По умолчанию: Plus 250 Stars, Pro 500 Stars.

**Пример:** `TELEGRAM_STARS_PRICE_PLUS=250`, `TELEGRAM_STARS_PRICE_PRO=500`

---

## Redis

### REDIS_URL
**Назначение:** Подключение к Redis (rate limiting, сессии).

**Где взять:** Локальный Redis или облачный (Upstash, Redis Cloud и т.п.).

**Пример:** `REDIS_URL=redis://localhost:6379/0`

---

## Платежи (опционально)

### CryptoCloud
**Где взять:** https://app.cryptocloud.plus  
Создайте проект → Интеграция → API:
- `CRYPTOCLOUD_API_KEY`
- `CRYPTOCLOUD_SHOP_ID`
- `CRYPTOCLOUD_SECRET_KEY`

Notification URL: `https://ваш-api.com/payments/cryptocloud/callback`

---

## Production

### ALLOWED_ORIGINS
**Где взять:** Через запятую домены фронтенда.

**Пример:** `ALLOWED_ORIGINS=https://epochaldialog.com,https://www.epochaldialog.com`

### VITE_API_BASE_URL
**Где взять:** URL вашего API (бэкенда).

**Пример:** `VITE_API_BASE_URL=https://api.epochaldialog.com`

### COOKIE_SECURE и COOKIE_SAMESITE
Обычно для production:
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`

---

## Webhook для Telegram Stars

После деплоя API установите webhook:

```http
POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://ваш-api.com/webhook/telegram
```

Замените `<TELEGRAM_BOT_TOKEN>` и домен на свои.
