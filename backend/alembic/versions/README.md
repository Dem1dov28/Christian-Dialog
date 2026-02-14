# Alembic migrations

Миграции создаются командой (из директории `backend`):

```bash
alembic revision --autogenerate -m "описание изменений"
```

Применение миграций:

```bash
alembic upgrade head
```

Откат на одну ревизию:

```bash
alembic downgrade -1
```

Требуется переменная окружения `DATABASE_URL` (или файл `backend/.env`).
