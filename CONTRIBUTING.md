# Руководство по внесению вклада (Epochal Dialog)

Спасибо за интерес к проекту. Ниже — краткие правила и подсказки для контрибьюторов.

## Как начать

1. Сделайте форк репозитория и клонируйте его.
2. Создайте ветку от `main` или `develop`:  
   `git checkout -b feature/краткое-описание` или `fix/описание-бага`.
3. Вносите изменения, пишите тесты там, где это уместно.
4. Убедитесь, что проходят тесты и линтеры (см. ниже).
5. Создайте Pull Request в основную ветку.

## Запуск тестов

### Backend

```bash
cd backend
pip install -r requirements.txt
# Юнит-тесты (без БД):
pytest tests/ -v -m unit
# Все тесты (нужна PostgreSQL и DATABASE_URL):
export DATABASE_URL=postgresql://user:pass@localhost:5432/timetalk
pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm ci
npm run lint
npm run test:e2e   # при необходимости предварительно: npm run dev
```

## Стиль кода

- **Backend (Python):** PEP 8, type hints где возможно. Используйте `black` и `ruff` (или текущие линтеры проекта), если они настроены.
- **Frontend (JavaScript/React):** следовать существующему стилю, ESLint из `package.json`.

## Структура репозитория

- `backend/` — FastAPI, API, сервисы, модели, тесты.
- `frontend/` — React (Vite), компоненты, хуки, контексты.
- `docs/` — документация (в т.ч. API).
- Миграции БД: `backend/alembic/` (команды см. в `backend/README.md`).

## Коммиты и PR

- Пишите осмысленные сообщения коммитов и названия PR.
- В описании PR укажите, что изменено и зачем; привязка к issue приветствуется.

## Вопросы

При возникновении вопросов создайте issue в репозитории.
