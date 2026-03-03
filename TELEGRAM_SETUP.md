# Telegram Mini App и Log In With Telegram — настройка

Epochal Dialog поддерживает:

1. **Telegram Mini App** — открытие приложения внутри Telegram с авто-входом по initData
2. **Log In With Telegram (OIDC)** — кнопка «Войти через Telegram» на обычном сайте (как «Войти через Google»)
3. **Синхронизация аккаунтов** — пользователи, зарегистрированные на сайте (в т.ч. через Google), могут привязать Telegram

## Сценарии

1. **Вход в Telegram** — если аккаунт уже привязан к Telegram, пользователь входит автоматически.
2. **Привязка аккаунта** — пользователь, зарегистрированный на сайте (в т.ч. через Google), может привязать свой Telegram: вводит email, получает код, привязывает аккаунт.

## Настройка

### 1. Создать бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather).
2. Отправьте `/newbot` и следуйте инструкциям.
3. Скопируйте выданный токен бота (например, `123456789:ABCdefGHI...`).

### 2. Настроить Mini App в боте

1. В @BotFather: `/mybots` → выберите бота → **Bot Settings** → **Menu Button**.
2. Укажите URL вашего приложения, например: `https://epochaldialog.com`
3. Либо создайте Web App в настройках: **Configure** → **Add Web App** → укажите URL.

### 3. Добавить переменные окружения

В `.env` или `.env.local`:

```
# Mini App (при открытии внутри Telegram)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...

# Log In With Telegram (кнопка на сайте)
# Получить в @BotFather → Bot Settings → Web Login
TELEGRAM_OIDC_CLIENT_ID=123456789
TELEGRAM_OIDC_CLIENT_SECRET=your_secret
TELEGRAM_OIDC_REDIRECT_URI=https://epochaldialog.com/auth/telegram-callback
```

### 4. Развернуть приложение

- Фронтенд и бэкенд должны быть доступны по HTTPS (для production).
- В `ALLOWED_ORIGINS` добавьте домен, с которого открывается Mini App (обычно `https://web.telegram.org` или ваш домен, если Mini App открывается по прямой ссылке).

## Поведение

- **Веб-браузер**: email/пароль, Google OAuth, **Войти через Telegram** (если OIDC настроен).
- **Telegram Mini App**:
  - При первом открытии показывается форма «Привязать аккаунт» (ввод email → код из письма).
  - После привязки при следующих открытиях пользователь входит автоматически.

## Оплата Telegram Stars (Mini App)

В Mini App доступна оплата Stars по вашим тарифам (Plus, Pro). Цены задаются в Stars:
- Plus: 160 Stars (≈$2)
- Pro: 400 Stars (≈$5)

Настройте `TELEGRAM_STARS_PRICE_PLUS` и `TELEGRAM_STARS_PRICE_PRO` в .env при необходимости.

**Webhook:** Telegram отправляет уведомления об оплате на ваш сервер. Установите webhook:
```
POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-api.com/webhook/telegram
```

## Log In With Telegram (OIDC)

Новая авторизация Telegram для приложений и сайтов (март 2026). Позволяет пользователям войти в обычном браузере через свой Telegram-аккаунт, без пароля.

- В @BotFather: **Bot Settings → Web Login** — добавьте Allowed URLs (origin сайта и `https://yoursite.com/auth/telegram-callback`).
- Скопируйте Client ID и Client Secret.

## Технические детали

- Верификация `initData` выполняется на бэкенде (HMAC-SHA256 с `WebAppData` и токеном бота).
- В модели `User` используются поля `telegram_id`, `telegram_username`.
- `auth_provider` может быть `local`, `google` или `telegram`; при привязке Google-аккаунта к Telegram сохраняется `google`.
