# 🚀 Быстрый старт локальной разработки

Краткая шпаргалка для запуска проекта на вашем компьютере.

---

## Первая настройка (один раз)

```bash
# 1. Клонировать репозиторий (если ещё не клонирован)
cd D:\Proga\Startups
git clone https://github.com/Dem1dov28/EpochalDialog.git "Epochal Dialog"
cd "Epochal Dialog"

# 2. Создать .env.local для локальной разработки
# ⚠️ ВАЖНО: .env содержит production настройки (для сервера)
# Локально используйте .env.local (он в .gitignore, не попадёт в Git)
cp .env.example .env.local
# Откройте .env.local и заполните минимум:
# - DB_PASSWORD (любой пароль для локальной БД)
# - SECRET_KEY (любой длинный текст)
# - OPENROUTER_API_KEY (ваш ключ)
# - GOOGLE_CLIENT_ID (если используете Google вход)
# - ENVIRONMENT=development (важно!)
# - ALLOWED_ORIGINS=http://localhost:5173
# - VITE_API_BASE_URL=http://localhost:8000

# 3. Запустить PostgreSQL и Redis
docker compose up -d postgresql redis

# 4. Настроить Backend (один раз)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # PowerShell
pip install -r requirements.txt

# 5. Настроить Frontend (один раз)
cd ../frontend
npm install
```

---

## Ежедневный запуск

**⚠️ ВАЖНО:** Убедитесь, что у вас есть `.env.local` с локальными настройками!
- `.env` — для production (на сервере)
- `.env.local` — для локальной разработки (не коммитится в Git)

### Терминал 1: Backend

```bash
cd "D:\Proga\Startups\Epochal Dialog"
docker compose up -d postgresql redis  # если ещё не запущены

cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

Backend: `http://localhost:8000`  
API Docs: `http://localhost:8000/docs`

### Терминал 2: Frontend

```bash
cd "D:\Proga\Startups\Epochal Dialog\frontend"
npm run dev
```

Frontend: `http://localhost:5173`

---

## Workflow: разработка → тест → деплой

### 1. Разработка
- Редактируйте код в VS Code
- Frontend автоматически перезагружается (hot reload)
- Backend нужно перезапускать вручную при изменениях

### 2. Тестирование
- Откройте `http://localhost:5173`
- Проверьте, что изменения работают
- Проверьте консоль браузера (F12) — нет ошибок

### 3. Коммит и push

```bash
git add .
git commit -m "Описание изменений"
git push
```

### 4. Деплой на сервер

```bash
# На сервере
ssh root@85.239.53.134
cd "/root/Epochal Dialog"
git pull
docker compose up -d --build frontend  # или backend, или оба
```

---

## Остановка

```bash
# Остановить backend: Ctrl+C в терминале backend

# Остановить frontend: Ctrl+C в терминале frontend

# Остановить БД и Redis:
docker compose down
```

---

## Полезные команды

```bash
# Посмотреть статус контейнеров
docker compose ps

# Логи PostgreSQL
docker compose logs postgresql

# Перезапустить БД
docker compose restart postgresql

# Очистить всё и начать заново (ОСТОРОЖНО!)
docker compose down -v
docker compose up -d postgresql redis
```

---

**Подробная инструкция:** [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md)
