# Epochal Dialog Backend

Backend для приложения Epochal Dialog - платформы для общения с ИИ-агентами.

## 📁 Структура проекта

```
backend/
├── api/                    # API роутеры
│   ├── agents.py          # Эндпоинты для агентов
│   ├── auth.py            # Аутентификация и авторизация
│   ├── chat.py            # Чат функциональность
│   ├── folders.py         # Управление папками
│   ├── multi_agent_chat.py # Мульти-агентные чаты
│   ├── saved_messages.py  # Сохраненные сообщения
│   └── search.py          # Поиск
├── config/                 # Конфигурация
│   ├── config.py          # Основная конфигурация
│   └── langchain_config.py # Конфигурация LangChain
├── core/                  # Основная логика
│   ├── auth.py            # Аутентификация
│   ├── database.py        # Настройка БД
│   ├── dependencies.py    # Зависимости FastAPI
│   ├── user_utils.py      # Утилиты пользователей
│   └── validators.py      # Валидаторы
├── models/                # SQLModel модели
│   ├── agent.py           # Модель агента
│   ├── conversation.py    # Модель беседы
│   ├── folder.py          # Модель папки
│   ├── message.py         # Модель сообщения
│   ├── multi_agent_conversation.py # Мульти-агентные беседы
│   └── user.py            # Модель пользователя
├── services/              # Бизнес-логика
│   ├── agent_service.py  # Сервис агентов
│   ├── conversation_service.py # Сервис бесед
│   ├── folder_service.py  # Сервис папок
│   ├── langchain_service.py # Сервис LangChain
│   ├── multi_agent_chat_service.py # Мульти-агентный сервис
│   └── subscription_service.py # Сервис подписок
├── scripts/               # Скрипты для администрирования
│   ├── add_new_agents.py  # Добавление новых агентов
│   ├── check_user_data.py # Проверка данных пользователя
│   ├── create_test_user.py # Создание тестового пользователя
│   ├── create_user.py     # Создание пользователя
│   ├── edit_prompts.py    # Редактирование промптов
│   ├── init_agents.py     # Инициализация агентов
│   ├── init_db.py         # Инициализация БД
│   ├── migrate_*.py      # Миграции БД
│   └── update_*.py       # Обновление данных
├── tests/                 # Тесты
│   └── test_*.py         # Unit и интеграционные тесты
└── utils/                 # Утилиты
    └── (будущие утилиты)
```

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта (см. `env.example`):

```env
SECRET_KEY=your-super-secret-key
OPENROUTER_API_KEY=your-openrouter-api-key
ALLOWED_ORIGINS=http://localhost:5173

# Для отправки жалоб на почту (опционально)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
REPORT_SENDER_EMAIL=your-email@gmail.com
REPORT_SENDER_PASSWORD=your-app-password
REPORT_RECIPIENT_EMAIL=admin@yoursite.com
```

**Настройка базы данных (PostgreSQL обязателен):**

Приложение требует PostgreSQL для работы. Установите `DATABASE_URL`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/timetalk
```

### 3. Настройка PostgreSQL

**Вариант A: Через Docker (рекомендуется для разработки)**

```bash
# Запустить PostgreSQL в Docker
docker-compose up -d postgresql

# Проверить статус
docker-compose ps
```

Подробнее: см. [DOCKER_SETUP.md](../DOCKER_SETUP.md)

**Вариант B: Локальная установка (для продакшена)**

```bash
# Установка PostgreSQL (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Создание базы данных
sudo -u postgres psql
CREATE DATABASE timetalk;
CREATE USER timetalk_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE timetalk TO timetalk_user;
\q

# (Опционально) оптимизация индексов/ANALYZE — используйте свои миграции/SQL при необходимости
```

### 4. Инициализация базы данных

```bash
# Создание таблиц (для новой базы)
python -c "from core.database import create_db_and_tables; create_db_and_tables()"
```

### 5. Запуск сервера

```bash
python main.py
```

или

```bash
uvicorn main:app --reload
```

Сервер будет доступен по адресу: `http://localhost:8002`

## 📋 Доступные команды

### Инициализация

```bash
# Синхронизация агентов из backend/config/agents.yaml в БД
python scripts/sync_agents_from_config.py
```

### Миграции БД (Alembic)

В проекте настроен Alembic. Из директории `backend` (с заданной `DATABASE_URL`):

```bash
# Применить все миграции
alembic upgrade head

# Создать новую миграцию после изменения моделей
alembic revision --autogenerate -m "описание изменений"

# Откатить на одну ревизию
alembic downgrade -1
```

Конфигурация: `alembic.ini`, `alembic/env.py`. Файлы миграций: `alembic/versions/`. Подробнее см. `alembic/versions/README.md`.

### Тестирование

```bash
# Запуск всех тестов
python -m pytest tests/

# Тест подключения к API
python tests/test_backend.py

# Тест работы с сообщениями
python tests/test_message_functions.py
```

## 🔧 Разработка

### Добавление нового эндпоинта

1. Создайте роутер в `api/`
2. Добавьте импорт в `main.py`
3. Подключите роутер к приложению

### Добавление новой модели

1. Создайте модель в `models/`
2. Обновите миграции в `scripts/`
3. Создайте сервис в `services/`

### Добавление нового сервиса

1. Создайте сервис в `services/`
2. Следуйте паттерну существующих сервисов
3. Добавьте тесты в `tests/`

## 🏗️ Архитектура

### API Layer (api/)
- Обработка HTTP запросов
- Валидация входных данных
- Вызов сервисов
- Формирование ответов

### Service Layer (services/)
- Бизнес-логика
- Работа с базой данных
- Интеграция с внешними API
- Управление состоянием

### Core Layer (core/)
- Аутентификация и авторизация
- Зависимости FastAPI
- Утилиты пользователей
- Валидаторы

### Models (models/)
- SQLModel модели
- Связи между моделями
- Схемы данных

### Configuration (config/)
- Конфигурация приложения
- Настройки окружения
- Конфигурация LangChain

### Scripts (scripts/)
- Скрипты для миграций
- Административные задачи
- Обновление данных

### Tests (tests/)
- Unit тесты
- Интеграционные тесты
- Тесты API

## 🔐 Безопасность

- JWT для аутентификации
- Хеширование паролей (bcrypt)
- CORS для защиты от атак
- Валидация входных данных

### Перед выкладкой на production

1. **backend/.env** — задать: `ENVIRONMENT=production`, `SECRET_KEY` (длинный случайный), `DATABASE_URL` с сильным паролем, `ALLOWED_ORIGINS=https://ваш-домен` (без localhost). По желанию: `SENTRY_DSN`, `REDIS_URL` (если Redis не на localhost).
2. **Корень проекта** — скопировать `env.example` в `.env`, подставить пароли для PostgreSQL и pgAdmin (для `docker compose`).
3. **HTTPS** — выдать сертификат (Let's Encrypt) и поставить Nginx/Caddy перед приложением.
4. **Зависимости** — один раз: `pip install pip-audit && python backend/scripts/check_vulnerabilities.py`.
5. **Бэкапы БД** — настроить cron для `scripts/backup_database.sh` (см. `backend/scripts/README-DB.md`).
6. **Сервер** — не запускать `docker compose` с профилем `development`, чтобы не поднимать pgAdmin.

Подробный аудит: [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) в корне репозитория.

## 📊 Технологии

- **FastAPI** - веб-фреймворк
- **SQLModel** - ORM
- **PostgreSQL** - база данных (обязательно)
- **LangChain** - работа с LLM
- **OpenRouter** - API для LLM
- **Pydantic** - валидация данных
- **JWT** - аутентификация

## 🗄️ База данных

Проект использует **PostgreSQL** (обязательно).

**Преимущества PostgreSQL:**
- ✅ Отличная производительность при больших объемах данных
- ✅ Полнотекстовый поиск встроен
- ✅ Поддержка множественных одновременных записей
- ✅ Масштабируемость
- ✅ JSONB для гибкой работы с JSON данными

**Настройка:**
1. Установите PostgreSQL или используйте Docker (см. [DOCKER_SETUP.md](../DOCKER_SETUP.md))
2. Создайте базу данных
3. Установите `DATABASE_URL` в переменных окружения (`.env` файл)
4. (Опционально) выполните свои SQL-оптимизации/индексацию при необходимости

## 📝 API Документация

Доступна по адресу: `http://localhost:8002/docs`

## 🐛 Известные проблемы

- Нет известных проблем

## 🤝 Вклад

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT


