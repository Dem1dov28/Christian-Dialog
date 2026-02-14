# Epochal Dialog

**Мультиагентная платформа для общения с AI-агентами**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📋 Описание

Epochal Dialog - современная платформа для интеллектуального общения с множественными AI-агентами. Поддерживает индивидуальные и групповые чаты, пользовательских агентов, работу с файлами и многое другое.

### Основные возможности

- 🤖 **Множественные AI-агенты** - более 50 предустановленных агентов для разных задач
- 💬 **Групповые чаты** - мультиагентные беседы с координацией между агентами
- 👤 **Пользовательские агенты** - создавайте своих агентов с уникальными промптами
- 📁 **Управление папками** - организуйте чаты по папкам
- 📎 **Работа с файлами** - загрузка и обработка документов (PDF, DOCX, XLSX и др.)
- 🔒 **Безопасность** - CSRF защита, rate limiting, антивирусная проверка файлов
- 🌐 **Многоязычность** - поддержка русского и английского языков
- 🎨 **Темы** - светлая и темная темы оформления
- 🔍 **Поиск** - полнотекстовый поиск по сообщениям

---

## 🚀 Быстрый старт

### Требования

- **Python** 3.11+
- **Node.js** 20+
- **PostgreSQL** 16+
- **Redis** 7+ (опционально, для rate limiting)
- **Docker** и **Docker Compose** (рекомендуется)

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd "Epochal Dialog"
```

### 2. Настройка переменных окружения

Создайте `.env` файл в корне проекта:

```env
# Backend
SECRET_KEY=your-super-secret-key-here
OPENROUTER_API_KEY=your-openrouter-api-key
DATABASE_URL=postgresql://timetalk_user:password@localhost:5432/timetalk
ALLOWED_ORIGINS=http://localhost:5173

# PostgreSQL (для Docker)
DB_NAME=timetalk
DB_USER=timetalk_user
DB_PASSWORD=your-strong-password

# Redis (опционально)
REDIS_URL=redis://localhost:6379/0

# Email (для отправки отчетов, опционально)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
REPORT_SENDER_EMAIL=your-email@gmail.com
REPORT_SENDER_PASSWORD=your-app-password
```

### 3. Запуск базы данных

```bash
# Запустить PostgreSQL и Redis через Docker
docker-compose up -d postgresql redis

# Для development также запустить pgAdmin
docker-compose --profile development up -d
```

### 4. Запуск Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Синхронизировать агентов из конфигурации
python scripts/sync_agents_from_config.py

# Запустить сервер
python main.py
```

Backend будет доступен на `http://localhost:8000`
API документация: `http://localhost:8000/docs`

### 5. Запуск Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить dev server
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

---

## 📚 Документация

- **[Backend README](./backend/README.md)** — подробная документация по backend
- **[Архитектура](./docs/ARCHITECTURE.md)** — слои backend/frontend, поток данных, безопасность
- **[API (эндпоинты, примеры)](./docs/API.md)** — описание API и эндпоинт `/health` для мониторинга
- **[CONTRIBUTING](./CONTRIBUTING.md)** — как контрибьютить, тесты, стиль кода
- **[Технологический стек](./STACK.md)** — список используемых технологий
- **[Аудит безопасности](./SECURITY_AUDIT.md)** - отчет по безопасности
- **[Технический аудит](./TECHNICAL_AUDIT_REPORT.md)** - полный технический аудит проекта
- **[Quick Start Security](./QUICK_START_SECURITY.md)** - быстрая настройка безопасности

---

## 🏗️ Архитектура

```
Epochal Dialog/
├── backend/          # FastAPI backend
│   ├── api/         # REST API endpoints
│   ├── core/        # Ядро системы (auth, database, security)
│   ├── models/      # Модели базы данных (SQLModel)
│   ├── services/    # Бизнес-логика
│   ├── config/      # Конфигурация
│   └── scripts/     # Утилиты и скрипты
├── frontend/         # React frontend
│   └── src/
│       ├── components/  # React компоненты
│       ├── contexts/    # React Context providers
│       ├── hooks/       # Кастомные хуки
│       └── services/    # API клиент
├── scripts/          # Общие скрипты
└── docker-compose.yml  # Docker конфигурация
```

---

## 🛠️ Технологии

### Backend
- **FastAPI** - веб-фреймворк
- **SQLModel** - ORM для работы с PostgreSQL
- **LangChain** - фреймворк для работы с LLM
- **OpenRouter** - API для доступа к различным LLM моделям
- **Redis** - кеширование и rate limiting
- **ClamAV** - антивирусная проверка файлов

### Frontend
- **React 18** - UI библиотека
- **Vite** - сборщик и dev server
- **Tailwind CSS** - стилизация
- **Radix UI** - доступные UI компоненты
- **Framer Motion** - анимации
- **React Router** - маршрутизация
- **TanStack Query** - управление серверным состоянием

---

## 🧪 Тестирование

```bash
# Backend тесты
cd backend
pytest tests/

# Frontend тесты
cd frontend
npm run test
```

---

## 🚢 Запуск на сервере (production)

Подробная инструкция: **[docs/DEPLOY.md](./docs/DEPLOY.md)**.

Кратко:

1. В **корне проекта** создайте `.env` из примера:
   ```bash
   cp .env.example .env
   ```
   Заполните `DB_PASSWORD`, `SECRET_KEY`, `ALLOWED_ORIGINS`, `OPENROUTER_API_KEY`, `VITE_API_BASE_URL` (и при необходимости `VITE_GOOGLE_CLIENT_ID`).

2. Запустите все сервисы (PostgreSQL, Redis, backend, frontend):
   ```bash
   docker compose up -d --build
   ```

3. Настройте reverse proxy и HTTPS (Nginx + Let's Encrypt) по схеме из [docs/DEPLOY.md](./docs/DEPLOY.md).

Для запуска только БД и Redis (backend/frontend локально):
```bash
docker compose up -d postgresql redis
```

---

## 📊 Мониторинг

- **Sentry** - отслеживание ошибок (опционально, настраивается через `SENTRY_DSN`)
- **Logs** - логи безопасности в `backend/logs/security.log`

---

## 🤝 Вклад в проект

См. **[CONTRIBUTING.md](./CONTRIBUTING.md)** — как запускать тесты, стиль кода, создание веток и PR.

---

## 📝 Лицензия

MIT License - см. [LICENSE](LICENSE) файл для деталей

---

## 📞 Контакты

- **Email:** support@epochaldialog.com
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)

---

## ⭐ Благодарности

- OpenRouter за API доступ к LLM моделям
- LangChain за отличный фреймворк
- Сообщество React и FastAPI за инструменты и библиотеки

---

**Сделано с ❤️ командой Epochal Dialog**
