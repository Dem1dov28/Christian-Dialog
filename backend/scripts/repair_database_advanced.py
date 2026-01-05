"""
Продвинутый скрипт для восстановления поврежденной базы данных SQLite
Использует несколько методов восстановления
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

def try_recover_with_vacuum():
    """Попытка восстановления через VACUUM INTO"""
    logger.info("Попытка восстановления через VACUUM INTO...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Пытаемся выполнить VACUUM INTO для создания новой базы
        cursor.execute(f"VACUUM INTO '{recovered_path}';")
        conn.close()
        
        # Проверяем результат
        if os.path.exists(recovered_path):
            check_conn = sqlite3.connect(recovered_path)
            check_cursor = check_conn.cursor()
            check_cursor.execute("PRAGMA integrity_check;")
            result = check_cursor.fetchone()
            check_conn.close()
            
            if result and result[0] == "ok":
                logger.info("Восстановление через VACUUM успешно!")
                return True
            else:
                logger.warning("VACUUM создал базу, но она все еще повреждена")
                os.remove(recovered_path)
        return False
    except Exception as e:
        logger.warning(f"VACUUM не удался: {e}")
        if os.path.exists(recovered_path):
            os.remove(recovered_path)
        return False

def try_recover_tables():
    """Попытка извлечь данные из отдельных таблиц"""
    logger.info("Попытка извлечения данных из таблиц...")
    
    recovered_conn = sqlite3.connect(recovered_path)
    recovered_cursor = recovered_conn.cursor()
    
    try:
        # Получаем список таблиц
        damaged_conn = sqlite3.connect(db_path)
        damaged_cursor = damaged_conn.cursor()
        
        try:
            damaged_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = damaged_cursor.fetchall()
            logger.info(f"Найдено таблиц: {len(tables)}")
            
            recovered_count = 0
            for (table_name,) in tables:
                try:
                    logger.info(f"Попытка извлечения таблицы: {table_name}")
                    # Получаем структуру таблицы
                    damaged_cursor.execute(f"PRAGMA table_info({table_name})")
                    columns = damaged_cursor.fetchall()
                    
                    if not columns:
                        continue
                    
                    # Создаем таблицу в новой базе
                    col_defs = ", ".join([f"{col[1]} {col[2]}" for col in columns])
                    recovered_cursor.execute(f"CREATE TABLE IF NOT EXISTS {table_name} ({col_defs})")
                    
                    # Пытаемся извлечь данные
                    try:
                        damaged_cursor.execute(f"SELECT * FROM {table_name}")
                        rows = damaged_cursor.fetchall()
                        
                        if rows:
                            # Вставляем данные
                            placeholders = ", ".join(["?" for _ in columns])
                            recovered_cursor.executemany(
                                f"INSERT INTO {table_name} VALUES ({placeholders})",
                                rows
                            )
                            logger.info(f"Восстановлено {len(rows)} строк из таблицы {table_name}")
                            recovered_count += 1
                    except Exception as e:
                        logger.warning(f"Не удалось извлечь данные из {table_name}: {e}")
                        
                except Exception as e:
                    logger.warning(f"Ошибка при обработке таблицы {table_name}: {e}")
                    continue
            
            damaged_conn.close()
            recovered_conn.commit()
            recovered_conn.close()
            
            if recovered_count > 0:
                logger.info(f"Успешно восстановлено {recovered_count} таблиц")
                return True
            else:
                logger.warning("Не удалось восстановить ни одной таблицы")
                return False
                
        except Exception as e:
            logger.error(f"Ошибка при получении списка таблиц: {e}")
            damaged_conn.close()
            recovered_conn.close()
            return False
            
    except Exception as e:
        logger.error(f"Ошибка при подключении к поврежденной базе: {e}")
        recovered_conn.close()
        return False

def main():
    """Основная функция восстановления"""
    
    if not os.path.exists(db_path):
        logger.error(f"База данных не найдена: {db_path}")
        return False
    
    # Метод 1: VACUUM INTO
    if try_recover_with_vacuum():
        # Заменяем старую базу
        if os.path.exists(backup_path):
            os.remove(backup_path)
        shutil.copy2(db_path, backup_path)
        shutil.move(recovered_path, db_path)
        logger.info("База данных восстановлена через VACUUM!")
        return True
    
    # Метод 2: Извлечение таблиц
    if os.path.exists(recovered_path):
        os.remove(recovered_path)
    
    if try_recover_tables():
        # Проверяем восстановленную базу
        check_conn = sqlite3.connect(recovered_path)
        check_cursor = check_conn.cursor()
        check_cursor.execute("PRAGMA integrity_check;")
        result = check_cursor.fetchone()
        check_conn.close()
        
        if result and result[0] == "ok":
            # Заменяем старую базу
            if os.path.exists(backup_path):
                os.remove(backup_path)
            shutil.copy2(db_path, backup_path)
            shutil.move(recovered_path, db_path)
            logger.info("База данных восстановлена через извлечение таблиц!")
            return True
    
    logger.error("Все методы восстановления не удались")
    logger.warning("База данных слишком повреждена. Возможно, потребуется создать новую базу.")
    return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)










