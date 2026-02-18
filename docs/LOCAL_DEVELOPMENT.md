# Локальная разработка и тестирование

Этот документ объясняет, как правильно разрабатывать и тестировать изменения **локально** перед деплоем на сервер.

---

## 🎯 Зачем тестировать локально?

**Проблема без тестирования:**
- Вы меняете код → сразу пушите на сервер → что-то ломается → сайт не работает → пользователи видят ошибки
- Приходится срочно чинить на сервере или откатывать изменения

**Правильный подход:**
- Вы меняете код → **тестируете локально** → всё работает → коммитите и пушите → деплоите на сервер → всё работает с первого раза

---

## 📋 Workflow (процесс работы)

```
1. Локальная разработка
   ↓
2. Тестирование на localhost
   ↓
3. Коммит и push в Git
   ↓
4. Деплой на сервер
```

Разберём каждый шаг подробно.

---

## 🛠️ Шаг 1: Настройка локальной среды

### Что нужно установить

**На вашем компьютере (Windows):**

1. **Git** — для работы с репозиторием
   - Скачать: https://git-scm.com/download/win
   - Установить, оставить настройки по умолчанию

2. **Docker Desktop** — для запуска PostgreSQL и Redis локально
   - Скачать: https://www.docker.com/products/docker-desktop/
   - Установить, запустить, дождаться зелёного статуса

3. **Python 3.11+** — для backend
   - Скачать: https://www.python.org/downloads/
   - При установке **галочка "Add Python to PATH"**

4. **Node.js 20+** — для frontend
   - Скачать: https://nodejs.org/
   - Установить LTS версию

5. **VS Code или другой редактор** — для редактирования кода

### Проверка установки

Откройте **PowerShell** или **Git Bash** и проверьте:

```bash
git --version        # должна быть версия Git
docker --version     # должна быть версия Docker
python --version     # должна быть Python 3.11+
node --version       # должна быть Node.js 20+
```

---

## 🚀 Шаг 2: Запуск проекта локально

### 1. Клонируйте репозиторий (если ещё не клонирован)

```bash
cd D:\Proga\Startups
git clone https://github.com/Dem1dov28/EpochalDialog.git "Epochal Dialog"
cd "Epochal Dialog"
```

### 2. Создайте `.env` для локальной разработки

**Важно:** на вашем компьютере должен быть **отдельный `.env`** для локальной разработки, **не тот же, что на сервере**.

```bash
# Скопируйте пример
cp .env.example .env

# Откройте .env в редакторе и заполните:
```

**Минимальный `.env` для локальной разработки:**

```env
# PostgreSQL (Docker)
DB_NAME=timetalk
DB_USER=timetalk_user
DB_PASSWORD=local_dev_password_123

# Backend
SECRET_KEY=local_dev_secret_key_12345678901234567890123456789012
DATABASE_URL=postgresql://timetalk_user:local_dev_password_123@localhost:5432/timetalk
REDIS_URL=redis://localhost:6379/0

ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

OPENROUTER_API_KEY=ваш_ключ_из_openrouter
GOOGLE_CLIENT_ID=ваш_client_id.apps.googleusercontent.com
ACCESS_TOKEN_EXPIRE_MINUTES=60

DEBUG=True
PORT=8000

# Frontend
VITE_API_BASE_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=ваш_client_id.apps.googleusercontent.com
```

**Важно:**
- `SECRET_KEY` — можно любой длинный случайный текст (для локальной разработки)
- `DB_PASSWORD` — любой пароль (только для локальной БД)
- `OPENROUTER_API_KEY` — тот же, что на сервере (или тестовый)
- `GOOGLE_CLIENT_ID` — тот же, что на сервере (или тестовый)

### 3. Запустите базу данных (PostgreSQL + Redis)

```bash
# Запустить только БД и Redis в Docker
docker compose up -d postgresql redis

# Проверить, что запустились
docker compose ps
```

Должны быть запущены:
- `timetalk_postgres` — PostgreSQL (порт 5432)
- `timetalk_redis` — Redis (порт 6379)

### 4. Запустите Backend локально (без Docker)

**В отдельном терминале:**

```bash
cd backend

# Создать виртуальное окружение (один раз)
python -m venv venv

# Активировать виртуальное окружение
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Или Git Bash:
source venv/Scripts/activate

# Установить зависимости (один раз)
pip install -r requirements.txt

# Запустить backend
python main.py
```

Backend запустится на `http://localhost:8000`

**Проверка:** откройте в браузере `http://localhost:8000/docs` — должна открыться документация API.

### 5. Запустите Frontend локально (dev-режим)

**В ещё одном терминале:**

```bash
cd frontend

# Установить зависимости (один раз)
npm install

# Запустить dev-сервер
npm run dev
```

Frontend запустится на `http://localhost:5173`

**Проверка:** откройте в браузере `http://localhost:5173` — должен открыться сайт.

---

## ✅ Шаг 3: Тестирование изменений

### Как тестировать изменения

**Пример: вы добавили новую кнопку на фронте**

1. **Откройте сайт** в браузере: `http://localhost:5173`
2. **Найдите место**, где должна быть кнопка
3. **Проверьте:**
   - Кнопка видна?
   - Кнопка работает (клик, действие)?
   - Нет ошибок в консоли браузера (F12 → Console)?
   - Нет ошибок в терминале backend?

**Пример: вы изменили API на бэкенде**

1. **Откройте документацию API:** `http://localhost:8000/docs`
2. **Попробуйте вызвать** изменённый эндпоинт через Swagger UI
3. **Или откройте фронт** и проверьте, что запросы к API работают

### Что проверять перед коммитом

- ✅ **Фронт открывается** без ошибок
- ✅ **Вход/регистрация** работают
- ✅ **Основные функции** работают (чат, агенты, библиотека)
- ✅ **Нет ошибок** в консоли браузера (F12)
- ✅ **Нет ошибок** в логах backend (терминал)
- ✅ **Изменения работают** как задумано

---

## 📝 Шаг 4: Коммит и push

### Когда коммитить

**Коммитьте только после того, как:**
- ✅ Протестировали изменения локально
- ✅ Всё работает как ожидалось
- ✅ Нет ошибок

### Как коммитить

```bash
# Посмотреть, что изменилось
git status

# Добавить изменённые файлы
git add frontend/src/components/MyComponent.jsx
git add backend/api/my_endpoint.py

# Закоммитить с понятным сообщением
git commit -m "Добавлена кнопка X в компоненте Y"

# Запушить в репозиторий
git push
```

**Правила коммитов:**
- Один коммит = одна логическая задача (например, "Добавлена кнопка удаления чата")
- Сообщение коммита должно быть понятным: что сделано и зачем
- **НЕ коммитьте** файл `.env` (он в `.gitignore`)

---

## 🚀 Шаг 5: Деплой на сервер

**Только после того, как изменения протестированы локально и запушены в Git:**

### На сервере

```bash
# Подключиться к серверу
ssh root@85.239.53.134

# Перейти в папку проекта
cd "/root/Epochal Dialog"

# Подтянуть изменения из Git
git pull

# Пересобрать и перезапустить изменённые сервисы
# Если меняли backend:
docker compose up -d --build backend

# Если меняли frontend:
docker compose up -d --build frontend

# Если меняли оба:
docker compose up -d --build
```

### Проверка на сервере

После деплоя проверьте:

1. **Логи** — нет ли ошибок:
   ```bash
   docker compose logs -f backend
   docker compose logs -f frontend
   ```

2. **Сайт работает** — откройте `https://epochaldialog.com` в браузере

3. **Основные функции** — вход, чат, библиотека работают

---

## 🔄 Полный цикл разработки (пример)

**Задача:** добавить кнопку "Удалить чат" в библиотеке

### 1. Локальная разработка

```bash
# На вашем компьютере
cd "D:\Proga\Startups\Epochal Dialog"

# Убедитесь, что backend и frontend запущены локально
# (см. шаги выше)

# Откройте файл в редакторе
code frontend/src/components/chat/ChatLibrary.jsx

# Добавьте кнопку, сохраните файл
# Frontend автоматически перезагрузится (hot reload)
```

### 2. Тестирование

- Откройте `http://localhost:5173`
- Перейдите в библиотеку чатов
- Найдите кнопку "Удалить чат"
- Нажмите на неё → проверьте, что чат удаляется
- Проверьте консоль браузера (F12) — нет ошибок

### 3. Коммит

```bash
git add frontend/src/components/chat/ChatLibrary.jsx
git commit -m "Добавлена кнопка удаления чата в библиотеке"
git push
```

### 4. Деплой на сервер

```bash
# На сервере
ssh root@85.239.53.134
cd "/root/Epochal Dialog"
git pull
docker compose up -d --build frontend
```

### 5. Проверка на сервере

- Откройте `https://epochaldialog.com`
- Проверьте, что кнопка появилась и работает

---

## 🐛 Отладка проблем

### Проблема: "Backend не запускается"

**Проверьте:**
1. PostgreSQL запущен? `docker compose ps`
2. `.env` заполнен правильно? `DATABASE_URL` указывает на `localhost:5432`?
3. Зависимости установлены? `pip install -r requirements.txt`

**Логи:**
```bash
# В терминале, где запущен backend, смотрите ошибки
# Или:
cd backend
python main.py
```

### Проблема: "Frontend не запускается"

**Проверьте:**
1. Node.js установлен? `node --version`
2. Зависимости установлены? `cd frontend && npm install`
3. Порт 5173 свободен? (закройте другие приложения на этом порту)

**Логи:**
```bash
cd frontend
npm run dev
# Смотрите ошибки в терминале
```

### Проблема: "Не могу подключиться к БД"

**Проверьте:**
1. PostgreSQL запущен: `docker compose ps`
2. В `.env` правильный `DATABASE_URL`: `postgresql://timetalk_user:пароль@localhost:5432/timetalk`
3. Пароль в `DATABASE_URL` совпадает с `DB_PASSWORD`?

---

## 💡 Полезные команды

### Локальная разработка

```bash
# Остановить все контейнеры
docker compose down

# Запустить только БД и Redis
docker compose up -d postgresql redis

# Посмотреть логи backend (если запущен в Docker)
docker compose logs -f backend

# Очистить БД и начать заново (ОСТОРОЖНО — удалит все данные!)
docker compose down -v
docker compose up -d postgresql redis
```

### Git

```bash
# Посмотреть изменения
git status
git diff

# Отменить изменения в файле (если ещё не закоммитили)
git restore frontend/src/components/MyComponent.jsx

# Посмотреть историю коммитов
git log --oneline -10
```

---

## 📚 Дополнительно

- **Backend API документация:** `http://localhost:8000/docs` (Swagger UI)
- **pgAdmin** (управление БД): `http://localhost:5050` (если запущен с `--profile development`)
- **Логи backend:** терминал, где запущен `python main.py`
- **Логи frontend:** терминал, где запущен `npm run dev`

---

## ✅ Чеклист перед деплоем

Перед тем как деплоить на сервер, убедитесь:

- [ ] Изменения протестированы локально
- [ ] Всё работает как ожидалось
- [ ] Нет ошибок в консоли браузера
- [ ] Нет ошибок в логах backend
- [ ] Изменения закоммичены и запушены в Git
- [ ] `.env` на сервере содержит нужные переменные (если добавили новые)

---

**Готово!** Теперь у вас есть правильный workflow: разработка → тест → деплой. 🎉
