# Технологический стек проекта TimeTalk

## Backend

### Основной фреймворк
- **FastAPI** (0.117.1) - современный веб-фреймворк для создания API
- **Uvicorn** (0.36.0) - ASGI сервер для запуска FastAPI приложения

### База данных
- **PostgreSQL 16** - реляционная база данных (используется через Docker)
- **SQLModel** (≥0.0.25) - ORM на основе SQLAlchemy и Pydantic
- **SQLAlchemy** (≥2.0.40) - инструментарий SQL и ORM
- **psycopg2-binary** (≥2.9.9) - драйвер PostgreSQL для Python
- **Pydantic** (≥2.11.9) - валидация данных и настройки

### AI/ML и LLM
- **LangChain** (0.3.7) - основной фреймворк для работы с LLM
- **LangChain OpenAI** (0.2.8) - интеграция с OpenAI
- **LangChain Community** (0.3.7) - дополнительные компоненты
- **LangChain Core** (0.3.17) - ядро LangChain
- **LangSmith** (0.1.147) - мониторинг и отладка LLM приложений
- **OpenAI** (1.108.2) - клиент для работы с OpenAI API

### Аутентификация и безопасность
- **python-jose[cryptography]** (3.3.0) - JWT токены
- **passlib[bcrypt]** (1.7.4) - хеширование паролей
- **bcrypt** (4.0.1) - криптографическое хеширование
- **google-auth** (2.37.0) - аутентификация через Google OAuth

### Обработка файлов
- **pdfplumber** (≥0.9.0) - извлечение текста из PDF
- **pandas** (≥2.0.0) - обработка данных (Excel, CSV)
- **openpyxl** (≥3.1.0) - работа с Excel файлами
- **python-docx** (≥1.1.0) - работа с Word документами
- **odfpy** (≥1.0.0) - работа с OpenDocument форматами
- **Pillow** (≥10.0.0) - обработка изображений

### Безопасность файлов
- **clamd** (1.0.2) - сканирование на вирусы через ClamAV
- **vt-py** (0.22.0) - интеграция с VirusTotal (опционально)

### Утилиты
- **python-dotenv** (1.0.0) - загрузка переменных окружения
- **python-multipart** (≥0.0.9) - обработка multipart данных
- **email-validator** (2.1.0) - валидация email адресов
- **python-dateutil** (2.8.2) - работа с датами
- **Jinja2** (3.1.2) - шаблонизатор
- **langdetect** (≥1.0.9) - определение языка текста
- **PyYAML** (≥6.0) - парсинг YAML конфигураций
- **httpx** (≥0.24.0) - асинхронный HTTP клиент
- **ddgs** (≥0.1.0) - поиск в интернете через DuckDuckGo
- **beautifulsoup4** (≥4.12.0) - парсинг HTML
- **lxml** (≥5.0.0) - парсинг XML/HTML

## Frontend

### Основной фреймворк
- **React** (18.3.1) - библиотека для создания пользовательских интерфейсов
- **React DOM** (18.3.1) - рендеринг React компонентов
- **Vite** (5.4.19) - сборщик и dev-сервер

### Роутинг
- **React Router DOM** (6.30.1) - маршрутизация в SPA

### UI библиотеки и компоненты
- **Radix UI** - набор доступных UI компонентов:
  - Accordion, Alert Dialog, Avatar, Checkbox, Collapsible
  - Context Menu, Dialog, Dropdown Menu, Hover Card
  - Label, Menubar, Navigation Menu, Popover
  - Progress, Radio Group, Scroll Area, Select
  - Separator, Slider, Switch, Tabs, Toast, Toggle, Tooltip
- **shadcn/ui** - компоненты на основе Radix UI и Tailwind CSS

### Стилизация
- **Tailwind CSS** (3.4.18) - utility-first CSS фреймворк
- **Tailwind CSS Animate** (1.0.7) - анимации для Tailwind
- **PostCSS** (8.5.6) - обработка CSS
- **Autoprefixer** (10.4.21) - автоматическое добавление префиксов
- **@tailwindcss/typography** (0.5.16) - плагин для типографики

### Анимации
- **Framer Motion** (12.23.24) - библиотека анимаций
- **React Spring** (10.0.3) - физические анимации
- **Embla Carousel React** (8.6.0) - карусели

### Управление состоянием
- **Zustand** (5.0.8) - легковесная библиотека управления состоянием
- **TanStack React Query** (5.83.0) - управление серверным состоянием и кеширование

### Формы и валидация
- **React Hook Form** (7.61.1) - управление формами
- **Zod** (3.25.76) - схема валидации
- **@hookform/resolvers** (3.10.0) - интеграция Zod с React Hook Form

### Дополнительные библиотеки
- **Lucide React** (0.462.0) - иконки
- **React Icons** (5.5.0) - дополнительные иконки
- **date-fns** (3.6.0) - работа с датами
- **React Day Picker** (8.10.1) - выбор дат
- **Recharts** (2.15.4) - графики и диаграммы
- **Leaflet** (1.9.4) - интерактивные карты
- **React Leaflet** (4.2.1) - React компоненты для Leaflet
- **Sonner** (1.7.4) - уведомления (toast)
- **next-themes** (0.3.0) - управление темами (темная/светлая)
- **@hello-pangea/dnd** (16.6.0) - drag and drop
- **React Resizable Panels** (2.1.9) - изменяемые панели
- **cmdk** (1.1.1) - командная палитра
- **vaul** (0.9.9) - drawer компоненты
- **input-otp** (1.4.2) - OTP ввод
- **class-variance-authority** (0.7.1) - утилиты для классов
- **clsx** (2.1.1) - условные классы
- **tailwind-merge** (2.6.0) - слияние Tailwind классов
- **@react-oauth/google** (0.12.2) - OAuth авторизация через Google

### Инструменты разработки
- **ESLint** (9.32.0) - линтер кода
- **@vitejs/plugin-react** (4.3.1) - плагин React для Vite

## Инфраструктура и DevOps

### Контейнеризация
- **Docker** - контейнеризация приложения
- **Docker Compose** - оркестрация контейнеров

### База данных (Docker)
- **PostgreSQL 16 Alpine** - контейнер базы данных
- **pgAdmin 4** - веб-интерфейс для управления PostgreSQL

### Сети
- Docker bridge network для связи между контейнерами

## Архитектура

### Паттерны
- **RESTful API** - архитектура API
- **Service Layer Pattern** - сервисный слой для бизнес-логики
- **Repository Pattern** - через SQLModel/SQLAlchemy
- **Dependency Injection** - через FastAPI Depends

### Структура проекта
- **Backend**: FastAPI приложение с модульной структурой
- **Frontend**: React SPA с компонентной архитектурой
- **Монолитный репозиторий** (monorepo) - backend и frontend в одном репозитории

## Особенности

- Мультиагентный чат с координацией агентов
- Система пользовательских агентов
- Обработка файлов с антивирусным сканированием
- Интеграция с внешними API (OpenAI, DuckDuckGo, Wikipedia)
- Система папок для организации чатов
- Бюджетирование и финансовое планирование
- Планирование поездок и достопримечательностей
- Многоязычная поддержка (i18n)
- Темная/светлая тема
- Адаптивный дизайн
