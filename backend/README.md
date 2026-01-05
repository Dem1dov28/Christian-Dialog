# AIgram Backend

Backend для приложения AIgram - платформы для общения с ИИ-агентами.

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

Создайте файл `.env` в корне проекта:

```env
SECRET_KEY=your-super-secret-key
OPENROUTER_API_KEY=your-openrouter-api-key
DATABASE_URL=sqlite:///./database.db
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Инициализация базы данных

```bash
python scripts/init_db.py
```

### 4. Запуск сервера

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
# Создание базы данных и агентов
python scripts/init_db.py

# Добавление новых агентов
python scripts/add_new_agents.py

# Создание тестового пользователя
python scripts/create_user.py
```

### Миграции

```bash
# Миграция папок
python scripts/migrate_folders.py

# Миграция видимости системных чатов
python scripts/migrate_system_chat_visibility.py
```

### Обновление данных

```bash
# Обновление агентов
python scripts/update_agents.py

# Обновление категорий
python scripts/update_categories.py

# Обновление изображений агентов
python scripts/update_agent_images.py
```

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

## 📊 Технологии

- **FastAPI** - веб-фреймворк
- **SQLModel** - ORM
- **SQLite** - база данных
- **LangChain** - работа с LLM
- **OpenRouter** - API для LLM
- **Pydantic** - валидация данных
- **JWT** - аутентификация

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


