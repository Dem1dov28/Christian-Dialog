# Архитектура Epochal Dialog

Краткое описание слоёв и потока данных. Подробности — в [STACK.md](../STACK.md) и [README](../README.md).

## Backend (FastAPI)

```
  HTTP Request
       │
       ▼
┌──────────────────┐
│  Middleware      │  CORS, CSRF, Rate Limit, Security Headers
└────────┬─────────┘
         ▼
┌──────────────────┐
│  API (api/)      │  Роуты, валидация ввода, вызов сервисов
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Services        │  Бизнес-логика, работа с БД и внешними API
└────────┬─────────┘
         ▼
┌──────────────────┐     ┌─────────────┐
│  Models (SQLModel)│────▶│  PostgreSQL │
└──────────────────┘     └─────────────┘
```

- **api/** — эндпоинты по доменам (agents, chat, auth, folders, static_files, file_attachments и т.д.).
- **services/** — AgentService, ConversationService, LangChainService и др.; не зависят от HTTP.
- **core/** — БД, auth, security, rate limiting, CSRF.
- **models/** — сущности БД (User, Agent, Conversation, Message, …).

Внешние зависимости: PostgreSQL, опционально Redis (rate limit, защита от брутфорса), OpenRouter/LangChain для LLM.

## Frontend (React + Vite)

```
  User
   │
   ▼
┌──────────────────┐
│  Pages / App     │  Роутинг (React Router)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Components      │  chat/, panels/, modals/, sidebar/, ui/
└────────┬─────────┘
         │
   ┌─────┴─────┐
   ▼           ▼
┌─────────┐  ┌─────────┐
│ Contexts│  │  Hooks  │  Состояние и переиспользуемая логика
└────┬────┘  └────┬────┘
     │            │
     ▼            ▼
┌──────────────────┐
│  services/api    │  HTTP-клиент к backend
└──────────────────┘
```

- **contexts/** — глобальное состояние (Auth, Chats, Agents, Theme, Language и т.д.).
- **hooks/** — логика чата, сообщений, модалок, скролла (разбита по доменам).
- **components/** — UI; чат собран из многих подкомпонентов и хуков.

## Безопасность

- JWT для сессий, bcrypt для паролей.
- CORS, CSRF-токен, rate limiting (Redis или in-memory).
- Санитизация имён файлов и проверка path traversal при раздаче файлов.
- Опционально: антивирус (ClamAV), Sentry для ошибок.

## Масштабирование

- Один инстанс backend + PostgreSQL (и при необходимости Redis) покрывает типичную нагрузку.
- Горизонтальное масштабирование: несколько воркеров uvicorn за load balancer; Redis — общий для rate limit и блокировок.
- Статика frontend — раздача через nginx или CDN после сборки.
