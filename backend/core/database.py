from sqlmodel import Session, SQLModel, create_engine
from typing import Generator
import os
import logging

# Импортируем все модели для создания таблиц
from models.agent import Agent
from models.conversation import Conversation
from models.message import Message
from models.multi_agent_conversation import MultiAgentConversation, ConversationAgent
from models.user import User
from models.file_attachment import FileAttachment
from models.test_answer import TestAnswer
from models.trip import Trip
from models.attraction_visit import AttractionVisit
from models.budget import Budget
from models.savings_goal import SavingsGoal
from models.recurring_payment import RecurringPayment

logger = logging.getLogger(__name__)

# Настройки базы данных: фиксируем путь относительно директории backend
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sqlite_file_name = os.path.join(BACKEND_DIR, "database.db")
sqlite_url = f"sqlite:///{sqlite_file_name}"

# ✅ КРИТИЧНО: Настройки для многопоточной работы с SQLite
connect_args = {
    "check_same_thread": False,
    "timeout": 30,  # Timeout для ожидания блокировок (секунды)
}

# ✅ Создаем движок базы данных с pool_pre_ping для проверки соединений
engine = create_engine(
    sqlite_url, 
    connect_args=connect_args,
    pool_pre_ping=True,  # Проверяем соединение перед использованием
    pool_size=10,  # Размер пула соединений
    max_overflow=20,  # Максимум дополнительных соединений
)


def create_db_and_tables():
    """Создать таблицы в базе данных"""
    SQLModel.metadata.create_all(engine)
    
    # ✅ КРИТИЧНО: Включаем WAL режим для SQLite (Write-Ahead Logging)
    # Это позволяет множественным читателям работать одновременно с одним писателем
    try:
        with engine.connect() as conn:
            # Включаем WAL режим
            conn.exec_driver_sql("PRAGMA journal_mode=WAL")
            logger.info("SQLite WAL режим включен - параллельные запросы разблокированы")
            
            # Увеличиваем busy_timeout для предотвращения ошибок блокировки
            conn.exec_driver_sql("PRAGMA busy_timeout = 30000")  # 30 секунд
            logger.info("SQLite busy_timeout установлен на 30 секунд")
            
            # Проверяем наличие колонки messages_cycle_started_at у таблицы user
            res = conn.exec_driver_sql("PRAGMA table_info(user)")
            columns = [row[1] for row in res.fetchall()]
            if "messages_cycle_started_at" not in columns:
                conn.exec_driver_sql("ALTER TABLE user ADD COLUMN messages_cycle_started_at DATETIME")
                logger.info("Добавлена колонка messages_cycle_started_at в таблицу user")
            
            # Проверяем наличие колонки is_system_chat у таблицы conversation
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "is_system_chat" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN is_system_chat BOOLEAN DEFAULT 0")
                logger.info("Добавлена колонка is_system_chat в таблицу conversation")

            # Проверяем наличие колонки user_rules у таблицы conversation
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "user_rules" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN user_rules VARCHAR DEFAULT '[]'")
                logger.info("Добавлена колонка user_rules в таблицу conversation")
            
            # Проверяем наличие колонки conversation_type у таблицы conversation
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "conversation_type" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'agents_only'")
                logger.info("Добавлена колонка conversation_type в таблицу conversation")
            
            # Проверяем наличие колонки conversation_type у таблицы multiagentconversation
            res = conn.exec_driver_sql("PRAGMA table_info(multiagentconversation)")
            columns = [row[1] for row in res.fetchall()]
            if "conversation_type" not in columns:
                conn.exec_driver_sql("ALTER TABLE multiagentconversation ADD COLUMN conversation_type VARCHAR(20) DEFAULT 'agents_only'")
                logger.info("Добавлена колонка conversation_type в таблицу multiagentconversation")
            
            # Проверяем, что agent_id может быть NULL в таблице conversation
            # В SQLite это уже должно работать, так как мы изменили модель, но для безопасности проверяем
            # Если agent_id был NOT NULL, нужно будет пересоздать таблицу (но это сложно, поэтому оставляем как есть)
            
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
            ensure_file_attachment_table()
            
            # Проверяем наличие колонки selected_model у таблицы conversation
            ensure_conversation_selected_model_column(conn)
            
            # Проверяем наличие колонки available_models у таблицы agent
            ensure_agent_available_models_column(conn)
    except Exception as e:
        logger.error(f"Ошибка при настройке БД: {e}", exc_info=True)
        # Не мешаем запуску, если миграция не удалась
        pass


def ensure_user_messages_cycle_column():
    """Гарантировать существование колонки user.messages_cycle_started_at (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            res = conn.exec_driver_sql("PRAGMA table_info(user)")
            columns = [row[1] for row in res.fetchall()]
            if "messages_cycle_started_at" not in columns:
                conn.exec_driver_sql("ALTER TABLE user ADD COLUMN messages_cycle_started_at DATETIME")
                logger.debug("Добавлена колонка messages_cycle_started_at в таблицу user (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки messages_cycle_started_at: {e}")
        # Тихо игнорируем, чтобы не ломать основной поток
        pass


def ensure_user_social_columns(connection=None):
    """Гарантировать существование колонок user.auth_provider и user.google_id."""
    try:
        if connection is not None:
            conn = connection
        else:
            conn = engine.connect()

        try:
            res = conn.exec_driver_sql("PRAGMA table_info(user)")
            columns = [row[1] for row in res.fetchall()]

            if "auth_provider" not in columns:
                conn.exec_driver_sql(
                    "ALTER TABLE user ADD COLUMN auth_provider VARCHAR DEFAULT 'local'"
                )
                logger.info("Добавлена колонка auth_provider в таблицу user")

            if "google_id" not in columns:
                conn.exec_driver_sql(
                    "ALTER TABLE user ADD COLUMN google_id VARCHAR"
                )
                conn.exec_driver_sql(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_google_id ON user(google_id)"
                )
                logger.info("Добавлена колонка google_id в таблицу user")
        finally:
            if connection is None:
                conn.close()
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонок соцавторизации: {e}")


def ensure_conversation_system_chat_column():
    """Гарантировать существование колонки conversation.is_system_chat (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "is_system_chat" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN is_system_chat BOOLEAN DEFAULT 0")
                logger.debug("Добавлена колонка is_system_chat в таблицу conversation (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки is_system_chat: {e}")
        # Тихо игнорируем, чтобы не ломать основной поток
        pass


def ensure_conversation_user_rules_column():
    """Гарантировать существование колонки conversation.user_rules (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "user_rules" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN user_rules VARCHAR DEFAULT '[]'")
                logger.debug("Добавлена колонка user_rules в таблицу conversation (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки user_rules: {e}")
        # Тихо игнорируем, чтобы не ломать основной поток
        pass


def ensure_conversation_selected_model_column(connection=None):
    """Гарантировать существование колонки conversation.selected_model."""
    try:
        conn = connection if connection else engine.connect()
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
            columns = [row[1] for row in res.fetchall()]
            if "selected_model" not in columns:
                conn.exec_driver_sql("ALTER TABLE conversation ADD COLUMN selected_model VARCHAR")
                logger.info("Добавлена колонка selected_model в таблицу conversation")
        finally:
            if not connection:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки selected_model: {e}", exc_info=True)


def ensure_agent_available_models_column(connection=None):
    """Гарантировать существование колонки agent.available_models."""
    try:
        conn = connection if connection else engine.connect()
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(agent)")
            columns = [row[1] for row in res.fetchall()]
            if "available_models" not in columns:
                conn.exec_driver_sql("ALTER TABLE agent ADD COLUMN available_models TEXT")
                logger.info("Добавлена колонка available_models в таблицу agent")
        finally:
            if not connection:
                conn.close()
    except Exception as e:
        logger.error(f"Ошибка при проверке колонки available_models: {e}", exc_info=True)


def ensure_conversation_unread_count_column(connection=None):
    """Гарантировать существование колонки conversation.unread_count."""
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_conversation_unread_count_column(conn)
        else:
            _ensure_conversation_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в conversation: {exc}")


def _ensure_conversation_unread_count_column(conn):
    res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
    columns = {row[1] for row in res.fetchall()}

    if "unread_count" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN unread_count INTEGER DEFAULT 0"
        )
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
        else:
            _ensure_multi_agent_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в multiagentconversation: {exc}")


def _ensure_multi_agent_unread_count_column(conn):
    res = conn.exec_driver_sql("PRAGMA table_info(multiagentconversation)")
    columns = {row[1] for row in res.fetchall()}

    if "unread_count" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE multiagentconversation ADD COLUMN unread_count INTEGER DEFAULT 0"
        )
        logger.info("Добавлена колонка unread_count в таблицу multiagentconversation")


def ensure_user_channel_subscription_unread_count_column(connection=None):
    """Гарантировать существование колонки unread_count в userchannelsubscription."""
    try:
        if connection is None:
            with engine.connect() as conn:
                _ensure_user_channel_subscription_unread_count_column(conn)
        else:
            _ensure_user_channel_subscription_unread_count_column(connection)
    except Exception as exc:
        logger.debug(f"Ошибка при проверке колонки unread_count в userchannelsubscription: {exc}")


def _ensure_user_channel_subscription_unread_count_column(conn):
    res = conn.exec_driver_sql("PRAGMA table_info(userchannelsubscription)")
    columns = {row[1] for row in res.fetchall()}

    if "unread_count" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE userchannelsubscription ADD COLUMN unread_count INTEGER DEFAULT 0"
        )
        logger.info("Добавлена колонка unread_count в таблицу userchannelsubscription")


def _ensure_multi_agent_conversation_avatar_column(conn):
    res = conn.exec_driver_sql("PRAGMA table_info(multiagentconversation)")
    columns = {row[1] for row in res.fetchall()}

    if "group_avatar" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE multiagentconversation ADD COLUMN group_avatar VARCHAR DEFAULT 'group'"
        )
        logger.info("Добавлена колонка group_avatar в таблицу multiagentconversation")


def _ensure_conversation_channel_columns(conn):
    res = conn.exec_driver_sql("PRAGMA table_info(conversation)")
    columns = {row[1] for row in res.fetchall()}

    if "is_channel" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN is_channel BOOLEAN DEFAULT 0"
        )
        logger.info("Добавлена колонка is_channel в таблицу conversation")

    if "is_listed" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN is_listed BOOLEAN DEFAULT 1"
        )
        logger.info("Добавлена колонка is_listed в таблицу conversation")

    if "channel_owner_id" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN channel_owner_id INTEGER REFERENCES user(id)"
        )
        logger.info("Добавлена колонка channel_owner_id в таблицу conversation")

    if "channel_description" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN channel_description VARCHAR"
        )
        logger.info("Добавлена колонка channel_description в таблицу conversation")

    if "frozen_at" not in columns:
        conn.exec_driver_sql(
            "ALTER TABLE conversation ADD COLUMN frozen_at DATETIME"
        )
        logger.info("Добавлена колонка frozen_at в таблицу conversation")

    # Индекс для ускоренного поиска каналов
    conn.exec_driver_sql(
        "CREATE INDEX IF NOT EXISTS ix_conversation_is_channel ON conversation(is_channel)"
    )


def ensure_user_pinned_chats_column():
    """Гарантировать существование колонки user.pinned_chats (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            res = conn.exec_driver_sql("PRAGMA table_info(user)")
            columns = [row[1] for row in res.fetchall()]
            if "pinned_chats" not in columns:
                conn.exec_driver_sql("ALTER TABLE user ADD COLUMN pinned_chats VARCHAR DEFAULT '[]'")
                logger.debug("Добавлена колонка pinned_chats в таблицу user (ленивая миграция)")
    except Exception as e:
        logger.debug(f"Ошибка при проверке колонки pinned_chats: {e}")
        # Тихо игнорируем, чтобы не ломать основной поток
        pass


def ensure_file_attachment_table():
    """Гарантировать существование таблицы fileattachment (ленивая миграция)."""
    try:
        with engine.connect() as conn:
            # Проверяем существование таблицы
            res = conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type='table' AND name='fileattachment'")
            if not res.fetchone():
                # Таблица не существует, SQLModel.metadata.create_all уже вызван в create_db_and_tables
                # Просто логируем, что таблица должна быть создана
                logger.info("Таблица fileattachment будет создана через SQLModel.metadata.create_all")
            else:
                # Таблица существует, проверяем наличие всех колонок
                res = conn.exec_driver_sql("PRAGMA table_info(fileattachment)")
                existing_columns = {row[1] for row in res.fetchall()}
                required_columns = {
                    "id", "filename", "original_filename", "file_path", "file_size",
                    "file_type", "file_extension", "user_id", "conversation_id",
                    "message_id", "created_at", "updated_at", "virus_scan_status", "virus_scan_date"
                }
                missing_columns = required_columns - existing_columns
                if missing_columns:
                    logger.warning(f"Отсутствующие колонки в fileattachment: {missing_columns}")
                    # SQLModel должен автоматически создать недостающие колонки при следующем запуске
                else:
                    logger.debug("Таблица fileattachment существует со всеми необходимыми колонками")
    except Exception as e:
        logger.error(f"Ошибка при проверке таблицы fileattachment: {e}", exc_info=True)
        # Не мешаем запуску, если миграция не удалась
        pass


def get_session() -> Generator[Session, None, None]:
    """Получить сессию базы данных"""
    with Session(engine) as session:
        # ✅ Устанавливаем WAL режим и busy_timeout для каждой сессии
        try:
            # Используем exec_driver_sql для PRAGMA команд
            session.exec_driver_sql("PRAGMA journal_mode=WAL")
            session.exec_driver_sql("PRAGMA busy_timeout=30000")
        except Exception:
            pass  # Игнорируем ошибки, если PRAGMA не поддерживается
        
        yield session
