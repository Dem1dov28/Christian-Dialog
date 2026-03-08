from sqlmodel import Session, SQLModel, create_engine
from typing import Generator, Optional
import os
import logging
from sqlalchemy import text

# Импортируем все модели для создания таблиц
from models.agent import Agent
from models.conversation import Conversation
from models.message import Message
from models.user_memory import UserMemory
from models.multi_agent_conversation import MultiAgentConversation, ConversationAgent
from models.user import User
from models.user_channel_subscription import UserChannelSubscription
from models.file_attachment import FileAttachment
from models.attraction_visit import AttractionVisit

logger = logging.getLogger(__name__)

# Настройки базы данных - PostgreSQL обязателен
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL не установлена в переменных окружения!\n"
        "Установите переменную окружения DATABASE_URL:\n"
        "  export DATABASE_URL=postgresql://user:password@localhost:5432/timetalk\n"
        "или добавьте в .env файл:\n"
        "  DATABASE_URL=postgresql://user:password@localhost:5432/timetalk"
    )

if not (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")):
    raise ValueError(
        f"DATABASE_URL должна указывать на PostgreSQL!\n"
        f"Текущее значение: {DATABASE_URL}\n"
        f"Ожидается формат: postgresql://user:password@host:port/database"
    )

logger.info(f"Используется база данных: PostgreSQL ({DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'configured'})")

# Настройки подключения для PostgreSQL
engine_kwargs = {
    "pool_pre_ping": True,
    "pool_size": 10,
    "max_overflow": 20,
    "pool_recycle": 300,  # Переиспользование соединений каждые 5 минут
}

# Создаем движок базы данных
engine = create_engine(
    DATABASE_URL,
    **engine_kwargs,
    echo=False,  # Установить в True для отладки SQL запросов
)


def get_column_names(conn, table_name: str) -> set:
    """Получение списка колонок таблицы для PostgreSQL.
    Использует переданное соединение напрямую через information_schema,
    чтобы видеть незакоммиченные изменения текущей транзакции и избежать дедлоков.
    """
    try:
        result = conn.execute(
            text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name
            """),
            {"table_name": table_name},
        )
        return {row[0] for row in result.fetchall()}
    except Exception as e:
        logger.error(f"Ошибка при получении колонок таблицы {table_name}: {e}")
        return set()


def table_exists(conn, table_name: str) -> bool:
    """Проверка существования таблицы в PostgreSQL."""
    try:
        result = conn.execute(
            text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = :table_name
                )
            """),
            {"table_name": table_name},
        )
        return result.scalar()
    except Exception as e:
        logger.error(f"Ошибка при проверке существования таблицы {table_name}: {e}")
        return False


def create_db_and_tables():
    """Создать таблицы в базе данных PostgreSQL"""
    SQLModel.metadata.create_all(engine)
    
    # Проверяем и добавляем необходимые колонки
    try:
        with engine.connect() as conn:
            # Проверяем наличие колонки messages_cycle_started_at у таблицы user
            columns = get_column_names(conn, "user")
            if "messages_cycle_started_at" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN messages_cycle_started_at TIMESTAMP"))
                logger.info("Добавлена колонка messages_cycle_started_at в таблицу user")
            
            # Проверяем наличие колонки is_system_chat у таблицы conversation
            columns = get_column_names(conn, "conversation")
            if "is_system_chat" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN is_system_chat BOOLEAN DEFAULT FALSE"))
                logger.info("Добавлена колонка is_system_chat в таблицу conversation")

            # Проверяем наличие колонки user_rules у таблицы conversation
            if "user_rules" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN user_rules TEXT DEFAULT '[]'"))
                logger.info("Добавлена колонка user_rules в таблицу conversation")
            
            # Проверяем наличие колонки conversation_type у таблицы conversation
            if "conversation_type" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'agents_only'"))
                logger.info("Добавлена колонка conversation_type в таблицу conversation")
            
            # Проверяем наличие колонки conversation_type у таблицы multiagentconversation
            columns = get_column_names(conn, "multiagentconversation")
            if "conversation_type" not in columns:
                conn.execute(text("ALTER TABLE multiagentconversation ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'agents_only'"))
                logger.info("Добавлена колонка conversation_type в таблицу multiagentconversation")
            
            # Проверяем дополнительные колонки для каналов
            ensure_conversation_channel_columns(conn)
            
            # Проверяем столбцы для функциональности непрочитанных сообщений
            ensure_conversation_unread_count_column(conn)
            ensure_multi_agent_unread_count_column(conn)
            ensure_user_channel_subscription_unread_count_column(conn)
            
            # Проверяем столбец group_avatar у многопользовательских чатов
            ensure_multi_agent_conversation_avatar_column(conn)

            # Проверяем столбцы для авторизации через соцсети
            ensure_user_social_columns(conn)

            # Проверяем существование таблицы fileattachment
            ensure_file_attachment_table(conn)
            
            # Проверяем наличие колонки selected_model у таблицы conversation
            ensure_conversation_selected_model_column(conn)
            
            # Проверяем наличие колонки available_models у таблицы agent
            ensure_agent_available_models_column(conn)
            
            # Проверяем наличие колонки user_id у таблицы agent (для пользовательских персонажей)
            ensure_agent_user_id_column(conn)
            # Колонка description для подробного описания агента (показ в карточке)
            ensure_agent_description_column(conn)

            # Таблица памяти агента о пользователе (умная персонализация)
            ensure_user_memory_table(conn)
            
            conn.commit()
    except Exception as e:
        logger.error(f"Ошибка при настройке БД: {e}", exc_info=True)
        raise


def ensure_user_messages_cycle_column():
    """Гарантировать существование колонки user.messages_cycle_started_at (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            columns = get_column_names(conn, "user")
            if "messages_cycle_started_at" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN messages_cycle_started_at TIMESTAMP"))
                conn.commit()
                logger.debug("Добавлена колонка messages_cycle_started_at в таблицу user (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки messages_cycle_started_at: {e}")


def ensure_user_social_columns(connection=None):
    """Гарантировать существование колонок user.auth_provider и user.google_id."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True

        try:
            columns = get_column_names(conn, "user")

            if "auth_provider" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN auth_provider VARCHAR DEFAULT 'local'"))
                logger.info("Добавлена колонка auth_provider в таблицу user")

            if "google_id" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN google_id VARCHAR"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_id ON \"user\"(google_id) WHERE google_id IS NOT NULL"))
                logger.info("Добавлена колонка google_id в таблицу user")

            if "telegram_id" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN telegram_id VARCHAR"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_telegram_id ON \"user\"(telegram_id) WHERE telegram_id IS NOT NULL"))
                logger.info("Добавлена колонка telegram_id в таблицу user")

            if "telegram_username" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN telegram_username VARCHAR"))
                logger.info("Добавлена колонка telegram_username в таблицу user")
            if "password_explicitly_set" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN password_explicitly_set BOOLEAN DEFAULT FALSE"))
                conn.execute(text("UPDATE \"user\" SET password_explicitly_set = TRUE WHERE auth_provider = 'local'"))
                logger.info("Добавлена колонка password_explicitly_set в таблицу user")
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонок соцавторизации: {e}")


def ensure_conversation_system_chat_column():
    """Гарантировать существование колонки conversation.is_system_chat (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            columns = get_column_names(conn, "conversation")
            if "is_system_chat" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN is_system_chat BOOLEAN DEFAULT FALSE"))
                conn.commit()
                logger.debug("Добавлена колонка is_system_chat в таблицу conversation (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки is_system_chat: {e}")


def ensure_conversation_user_rules_column():
    """Гарантировать существование колонки conversation.user_rules (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            columns = get_column_names(conn, "conversation")
            if "user_rules" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN user_rules TEXT DEFAULT '[]'"))
                conn.commit()
                logger.debug("Добавлена колонка user_rules в таблицу conversation (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки user_rules: {e}")


def ensure_conversation_selected_model_column(connection=None):
    """Гарантировать существование колонки conversation.selected_model."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True
        
        try:
            columns = get_column_names(conn, "conversation")
            if "selected_model" not in columns:
                conn.execute(text("ALTER TABLE conversation ADD COLUMN selected_model VARCHAR"))
                logger.info("Добавлена колонка selected_model в таблицу conversation")
                if should_close:
                    conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки selected_model: {e}", exc_info=True)


def ensure_agent_available_models_column(connection=None):
    """Гарантировать существование колонки agent.available_models."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True
        
        try:
            columns = get_column_names(conn, "agent")
            if "available_models" not in columns:
                conn.execute(text("ALTER TABLE agent ADD COLUMN available_models JSONB"))
                logger.info("Добавлена колонка available_models в таблицу agent")
                if should_close:
                    conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки available_models: {e}", exc_info=True)


def ensure_conversation_unread_count_column(connection=None):
    """Гарантировать существование колонки conversation.unread_count."""
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_conversation_unread_count_column(conn)
                conn.commit()
        else:
            _ensure_conversation_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в conversation: {exc}")


def _ensure_conversation_unread_count_column(conn):
    columns = get_column_names(conn, "conversation")

    if "unread_count" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN unread_count INTEGER DEFAULT 0"))
        logger.info("Добавлена колонка unread_count в таблицу conversation")


def ensure_conversation_channel_columns(connection=None):
    """
    Гарантировать существование колонок для каналов в таблице conversation.
    Может принимать активное соединение (для переиспользования в create_db_and_tables).
    """
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_conversation_channel_columns(conn)
                conn.commit()
        else:
            _ensure_conversation_channel_columns(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке каналов conversation: {exc}")


def ensure_multi_agent_conversation_avatar_column(connection=None):
    """
    Гарантировать существование колонки group_avatar в таблице multiagentconversation.
    """
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_multi_agent_conversation_avatar_column(conn)
                conn.commit()
        else:
            _ensure_multi_agent_conversation_avatar_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки group_avatar: {exc}")


def ensure_multi_agent_unread_count_column(connection=None):
    """Гарантировать существование колонки unread_count в multiagentconversation."""
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_multi_agent_unread_count_column(conn)
                conn.commit()
        else:
            _ensure_multi_agent_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в multiagentconversation: {exc}")


def _ensure_multi_agent_unread_count_column(conn):
    columns = get_column_names(conn, "multiagentconversation")

    if "unread_count" not in columns:
        conn.execute(text("ALTER TABLE multiagentconversation ADD COLUMN unread_count INTEGER DEFAULT 0"))
        logger.info("Добавлена колонка unread_count в таблицу multiagentconversation")


def ensure_user_channel_subscription_unread_count_column(connection=None):
    """Гарантировать существование колонки unread_count в userchannelsubscription."""
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_user_channel_subscription_unread_count_column(conn)
                conn.commit()
        else:
            _ensure_user_channel_subscription_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в userchannelsubscription: {exc}")


def _ensure_user_channel_subscription_unread_count_column(conn):
    if not table_exists(conn, "userchannelsubscription"):
        return
    
    columns = get_column_names(conn, "userchannelsubscription")

    if "unread_count" not in columns:
        conn.execute(text("ALTER TABLE userchannelsubscription ADD COLUMN unread_count INTEGER DEFAULT 0"))
        logger.info("Добавлена колонка unread_count в таблицу userchannelsubscription")


def _ensure_multi_agent_conversation_avatar_column(conn):
    columns = get_column_names(conn, "multiagentconversation")

    if "group_avatar" not in columns:
        conn.execute(text("ALTER TABLE multiagentconversation ADD COLUMN group_avatar VARCHAR DEFAULT 'group'"))
        logger.info("Добавлена колонка group_avatar в таблицу multiagentconversation")
    
    # Добавляем колонку для URL загруженного аватара
    if "group_avatar_url" not in columns:
        conn.execute(text("ALTER TABLE multiagentconversation ADD COLUMN group_avatar_url VARCHAR DEFAULT NULL"))
        logger.info("Добавлена колонка group_avatar_url в таблицу multiagentconversation")


def _ensure_conversation_channel_columns(conn):
    columns = get_column_names(conn, "conversation")

    if "is_channel" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN is_channel BOOLEAN DEFAULT FALSE"))
        logger.info("Добавлена колонка is_channel в таблицу conversation")

    if "is_listed" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN is_listed BOOLEAN DEFAULT TRUE"))
        logger.info("Добавлена колонка is_listed в таблицу conversation")

    if "channel_owner_id" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN channel_owner_id INTEGER REFERENCES \"user\"(id)"))
        logger.info("Добавлена колонка channel_owner_id в таблицу conversation")

    if "channel_description" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN channel_description VARCHAR"))
        logger.info("Добавлена колонка channel_description в таблицу conversation")

    if "frozen_at" not in columns:
        conn.execute(text("ALTER TABLE conversation ADD COLUMN frozen_at TIMESTAMP"))
        logger.info("Добавлена колонка frozen_at в таблицу conversation")

    # Индекс для ускоренного поиска каналов
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_conversation_is_channel ON conversation(is_channel)"))


def ensure_user_pinned_chats_column():
    """Гарантировать существование колонки user.pinned_chats (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            columns = get_column_names(conn, "user")
            if "pinned_chats" not in columns:
                conn.execute(text("ALTER TABLE \"user\" ADD COLUMN pinned_chats TEXT DEFAULT '[]'"))
                conn.commit()
                logger.debug("Добавлена колонка pinned_chats в таблицу user (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки pinned_chats: {e}")


def ensure_file_attachment_table(connection=None):
    """Гарантировать существование таблицы fileattachment (ленивая миграция)."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True
        
        try:
            if not table_exists(conn, "fileattachment"):
                logger.info("Таблица fileattachment будет создана через SQLModel.metadata.create_all")
            else:
                # Таблица существует, проверяем наличие всех колонок
                existing_columns = get_column_names(conn, "fileattachment")
                required_columns = {
                    "id", "filename", "original_filename", "file_path", "file_size",
                    "file_type", "file_extension", "user_id", "conversation_id",
                    "message_id", "created_at", "updated_at", "virus_scan_status", "virus_scan_date"
                }
                missing_columns = required_columns - existing_columns
                if missing_columns:
                    logger.warning(f"Отсутствующие колонки в fileattachment: {missing_columns}")
                else:
                    logger.debug("Таблица fileattachment существует со всеми необходимыми колонками")
            
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке таблицы fileattachment: {e}", exc_info=True)


def ensure_agent_description_column(connection=None):
    """Гарантировать существование колонки agent.description (подробное описание для карточки)."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True
        try:
            columns = get_column_names(conn, "agent")
            if "description" not in columns:
                conn.execute(text("ALTER TABLE agent ADD COLUMN description TEXT"))
                logger.info("Добавлена колонка description в таблицу agent")
                if should_close:
                    conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки description в agent: {e}", exc_info=True)


def ensure_user_memory_table(connection=None):
    """Создать таблицу user_memory для хранения фактов о пользователе."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True

        try:
            if not table_exists(conn, "user_memory"):
                conn.execute(text("""
                    CREATE TABLE user_memory (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
                        agent_id INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
                        memory_type VARCHAR(32) DEFAULT 'other',
                        content TEXT NOT NULL,
                        importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
                        source_message_id INTEGER REFERENCES message(id) ON DELETE SET NULL,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_memory_user_id ON user_memory(user_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_memory_agent_id ON user_memory(agent_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_memory_user_agent ON user_memory(user_id, agent_id)"))
                logger.info("Создана таблица user_memory для умной памяти агента")
            if should_close:
                conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при создании таблицы usermemory: {e}", exc_info=True)


def ensure_agent_user_id_column(connection=None):
    """Гарантировать существование колонки agent.user_id для пользовательских персонажей."""
    try:
        if connection is not None:
            conn = connection
            should_close = False
        else:
            conn = engine.connect()
            should_close = True
        
        try:
            columns = get_column_names(conn, "agent")
            if "user_id" not in columns:
                conn.execute(text("ALTER TABLE agent ADD COLUMN user_id INTEGER REFERENCES \"user\"(id) ON DELETE CASCADE"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_agent_user_id ON agent(user_id)"))
                logger.info("Добавлена колонка user_id в таблицу agent")
                if should_close:
                    conn.commit()
        finally:
            if should_close:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки user_id в agent: {e}", exc_info=True)


def get_session() -> Generator[Session, None, None]:
    """Получить сессию базы данных PostgreSQL"""
    with Session(engine) as session:
        yield session
