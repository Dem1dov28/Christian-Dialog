#!/bin/bash
# Бэкап PostgreSQL для Epochal Dialog / TimeTalk.
# Конфигурация через переменные окружения или значения по умолчанию.
#
# Использование:
#   ./scripts/backup_database.sh
#   BACKUP_DIR=/data/backups RETENTION_DAYS=14 ./scripts/backup_database.sh
#
# Cron (ежедневно в 02:00):
#   0 2 * * * /path/to/project/scripts/backup_database.sh >> /var/log/db_backup.log 2>&1

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups/postgresql}"
DB_NAME="${DB_NAME:-timetalk}"
DB_USER="${DB_USER:-timetalk_user}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
# Пароль: задать PGPASSWORD в окружении или в .env (не хранить в скрипте)
RETENTION_DAYS="${RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "Starting database backup..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "Backup completed: $BACKUP_FILE"

echo "Cleaning old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup size: $BACKUP_SIZE"
