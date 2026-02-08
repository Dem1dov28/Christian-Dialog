import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
backend_dir = Path(__file__).parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path)

from sqlmodel import text
from core.database import engine
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def remove_column():
    logger.info("Starting removal of is_system_chat_hidden column from user table...")
    try:
        with engine.connect() as conn:
            # Используем кавычки для таблицы user, так как это зарезервированное слово в PostgreSQL
            conn.execute(text('ALTER TABLE "user" DROP COLUMN IF EXISTS is_system_chat_hidden'))
            conn.commit()
            logger.info("Successfully removed is_system_chat_hidden column from user table.")
    except Exception as e:
        logger.error(f"Error removing column: {e}")

if __name__ == "__main__":
    remove_column()
