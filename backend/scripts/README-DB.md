# Бэкапы БД

Скрипт в корне репозитория: **`scripts/backup_database.sh`**.

Перед запуском задайте пароль БД (для `pg_dump`), например:

```bash
export PGPASSWORD="ваш_пароль_от_timetalk_user"
./scripts/backup_database.sh
```

Или создайте рядом с проектом `.env` только для крона и подключайте его в задании (например `source /path/to/.env` перед вызовом скрипта).

Переменные (по желанию):

| Переменная       | По умолчанию     | Описание                    |
|------------------|------------------|-----------------------------|
| `BACKUP_DIR`     | `./backups/postgresql` | Каталог для дампов   |
| `DB_NAME`        | `timetalk`       | Имя БД                      |
| `DB_USER`        | `timetalk_user`  | Пользователь для pg_dump    |
| `DB_HOST`        | `localhost`      | Хост PostgreSQL             |
| `DB_PORT`        | `5432`           | Порт                        |
| `RETENTION_DAYS` | `7`              | Хранить бэкапы за N дней    |

Пример cron (ежедневно в 02:00):

```bash
0 2 * * * cd /path/to/project && source .env 2>/dev/null; export PGPASSWORD="$DB_PASSWORD"; ./scripts/backup_database.sh >> /var/log/db_backup.log 2>&1
```
