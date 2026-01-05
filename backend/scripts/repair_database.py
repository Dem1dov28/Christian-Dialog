"""
Скрипт для восстановления поврежденной базы данных SQLite
"""
import sqlite3
import os
import shutil
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Путь к базе данных
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
db_path = os.path.join(BACKEND_DIR, "database.db")
backup_path = os.path.join(BACKEND_DIR, "database.db.backup")
recovered_path = os.path.join(BACKEND_DIR, "database.db.recovered")

def repair_database():
    """Попытка восстановить поврежденную базу данных"""
    
    if not os.path.exists(db_path):
        logger.error(f"База данных не найдена: {db_path}")
        return False
    
    logger.info(f"Проверка базы данных: {db_path}")
    
    try:
        # Попытка подключиться и проверить целостность
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверка целостности
        cursor.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()
        
        if result and result[0] == "ok":
            logger.info("База данных не повреждена!")
            conn.close()
            return True
        else:
            logger.warning(f"База данных повреждена: {result}")
            conn.close()
    except sqlite3.DatabaseError as e:
        logger.error(f"Ошибка при проверке базы данных: {e}")
    
    # Попытка восстановления через .dump и .read
    logger.info("Попытка восстановления базы данных...")
    
    try:
        # Создаем новую базу данных
        if os.path.exists(recovered_path):
            os.remove(recovered_path)
        
        new_conn = sqlite3.connect(recovered_path)
        
        # Пытаемся скопировать данные из поврежденной базы
        old_conn = sqlite3.connect(db_path)
        
        # Пытаемся выполнить dump
        try:
            for line in old_conn.iterdump():
                try:
                    new_conn.executescript(line)
                except sqlite3.Error as e:
                    logger.warning(f"Пропущена строка при восстановлении: {e}")
                    continue
        except Exception as e:
            logger.error(f"Ошибка при dump: {e}")
        
        old_conn.close()
        new_conn.close()
        
        # Проверяем восстановленную базу
        check_conn = sqlite3.connect(recovered_path)
        check_cursor = check_conn.cursor()
        check_cursor.execute("PRAGMA integrity_check;")
        check_result = check_cursor.fetchone()
        check_conn.close()
        
        if check_result and check_result[0] == "ok":
            logger.info("База данных успешно восстановлена!")
            # Заменяем старую базу на восстановленную
            if os.path.exists(backup_path):
                os.remove(backup_path)
            shutil.copy2(db_path, backup_path)
            shutil.move(recovered_path, db_path)
            logger.info(f"Резервная копия сохранена: {backup_path}")
            return True
        else:
            logger.error("Восстановление не удалось")
            return False
            
    except Exception as e:
        logger.error(f"Ошибка при восстановлении: {e}")
        return False

if __name__ == "__main__":
    success = repair_database()
    if not success:
        logger.warning("Восстановление не удалось. Возможно, потребуется создать новую базу данных.")
        logger.info("Если данные критичны, попробуйте использовать специализированные инструменты восстановления SQLite.")
    exit(0 if success else 1)










