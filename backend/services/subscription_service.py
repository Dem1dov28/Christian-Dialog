from sqlmodel import Session, select, func
from models.user import User
from models.message import Message
from models.conversation import Conversation
from models.multi_agent_conversation import MultiAgentConversation
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class SubscriptionService:
    """Сервис для управления подписками пользователей"""
    
    # Конфигурация тарифов
    # Для всех тарифов: сброс сообщений через 24 часа от начала цикла
    # Подписка pro истекает через месяц (через expires_at)
    SUBSCRIPTION_CONFIGS = {
        "free": {
            "messages_limit": 50,
            "max_chats": 10,
            "max_group_agents": 2,
            "max_files_per_message": 0,
            "max_files_per_day": 0,
            "api_access": False,
            "price": 0,
            "duration_days": None,
        },
        "plus": {
            "messages_limit": 150,
            "max_chats": 25,
            "max_group_agents": 5,
            "max_files_per_message": 1,
            "max_files_per_day": 5,
            "api_access": False,
            "price": 2,
            "duration_days": 30,
        },
        "pro": {
            "messages_limit": 250,
            "max_chats": 50,
            "max_group_agents": 5,
            "max_files_per_message": 3,
            "max_files_per_day": 10,
            "api_access": True,
            "price": 5,
            "duration_days": 30,
        },
        "api": {
            "messages_limit": 500,
            "max_chats": 50,
            "max_group_agents": 5,
            "max_files_per_message": 3,
            "max_files_per_day": 10,
            "api_access": True,
            "price": 5,
            "duration_days": 30,
        }
    }
    
    @staticmethod
    def _add_months(dt: datetime, months: int) -> datetime:
        """Добавить к дате целое число календарных месяцев, сохранив номер дня, если возможно.
        Если день отсутствует в целевом месяце, берём последний доступный день этого месяца.
        Время нормализуем к полуночи для единообразия подписочного периода.
        """
        month = dt.month - 1 + months
        year = dt.year + month // 12
        month = month % 12 + 1
        days_in_month = [
            31,
            29 if (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)) else 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
        ][month - 1]
        day = min(dt.day, days_in_month)
        return dt.replace(year=year, month=month, day=day, hour=0, minute=0, second=0, microsecond=0)

    @classmethod
    def get_subscription_config(cls, tier: str) -> dict:
        """Получить конфигурацию тарифа"""
        return cls.SUBSCRIPTION_CONFIGS.get(tier, cls.SUBSCRIPTION_CONFIGS["free"]).copy()

    @classmethod
    def get_max_group_agents(cls, tier: str) -> int:
        """Максимум агентов в групповом чате для тарифа"""
        config = cls.get_subscription_config(tier)
        return config.get("max_group_agents", 2)

    @classmethod
    def get_max_chats(cls, tier: str) -> int:
        """Максимум чатов в списке для тарифа"""
        config = cls.get_subscription_config(tier)
        return config.get("max_chats", 10)

    @classmethod
    def get_max_files_per_message(cls, tier: str) -> int:
        """Максимум файлов к одному сообщению для тарифа"""
        config = cls.get_subscription_config(tier)
        return config.get("max_files_per_message", 0)

    @classmethod
    def get_max_files_per_day(cls, tier: str) -> int:
        """Максимум файлов/изображений в сутки для тарифа (сброс как у сообщений)"""
        config = cls.get_subscription_config(tier)
        return config.get("max_files_per_day", 0)

    @classmethod
    def count_files_uploaded_in_current_cycle(cls, db: Session, user: User) -> int:
        """
        Подсчитать файлы пользователя за текущий цикл (тот же, что и для сообщений).
        Цикл сбрасывается в 00:00 UTC.
        """
        from models.file_attachment import FileAttachment

        cls.ensure_message_cycle(db, user)
        cycle_start = getattr(user, "messages_cycle_started_at", None)
        if not cycle_start:
            return 0

        return db.exec(
            select(func.count(FileAttachment.id)).where(
                FileAttachment.user_id == user.id,
                FileAttachment.created_at >= cycle_start,
            )
        ).first() or 0

    @classmethod
    def can_upload_files(cls, db: Session, user: User, count_new: int = 1) -> bool:
        """
        Проверить, может ли пользователь загрузить count_new файлов в текущем цикле.
        Лимит сбрасывается каждые сутки, как и лимит сообщений.
        """
        max_per_day = cls.get_max_files_per_day(user.subscription_tier or "free")
        if max_per_day == 0:
            return False
        used = cls.count_files_uploaded_in_current_cycle(db, user)
        return (used + count_new) <= max_per_day

    @classmethod
    def count_user_chats(cls, db: Session, user_id: int) -> int:
        """Подсчитать чаты пользователя (Conversation + MultiAgentConversation), исключая системный чат и каналы"""
        from models.conversation import Conversation
        from models.multi_agent_conversation import MultiAgentConversation

        conv_count = db.exec(
            select(func.count(Conversation.id))
            .where(Conversation.user_id == user_id)
            .where(Conversation.is_system_chat == False)  # noqa: E712
            .where(Conversation.is_channel == False)  # noqa: E712 - exclude channels
        ).first() or 0

        multi_count = db.exec(
            select(func.count(MultiAgentConversation.id))
            .where(MultiAgentConversation.user_id == user_id)
        ).first() or 0

        return (conv_count or 0) + (multi_count or 0)
    
    @classmethod
    def upgrade_subscription(
        cls, 
        db: Session, 
        user: User, 
        new_tier: str,
        api_key: Optional[str] = None
    ) -> dict:
        """
        Обновить подписку пользователя
        
        Args:
            db: Сессия базы данных
            user: Пользователь
            new_tier: Новый тариф (free, plus, pro, api)
            api_key: API ключ (только для тарифа api)
        
        Returns:
            dict: Результат операции
        """
        try:
            # Проверяем валидность тарифа
            if new_tier not in cls.SUBSCRIPTION_CONFIGS:
                return {
                    "success": False,
                    "message": f"Неизвестный тариф: {new_tier}",
                    "error": "INVALID_TIER"
                }
            
            # Проверяем, не пытается ли пользователь перейти на тот же тариф
            if user.subscription_tier == new_tier:
                return {
                    "success": False,
                    "message": f"У вас уже активен тариф {new_tier}",
                    "error": "SAME_TIER"
                }
            
            # Получаем конфигурацию нового тарифа
            config = cls.get_subscription_config(new_tier)
            
            # Для тарифа API проверяем наличие API ключа
            if new_tier == "api" and not api_key:
                return {
                    "success": False,
                    "message": "Для тарифа API необходим API ключ",
                    "error": "MISSING_API_KEY"
                }
            
            # Обновляем данные пользователя
            old_tier = user.subscription_tier
            user.subscription_tier = new_tier
            user.messages_limit = config["messages_limit"]
            user.api_access = config["api_access"]
            
            # Устанавливаем дату истечения подписки: ровно +1 календарный месяц от момента апгрейда
            if config["duration_days"]:
                now = datetime.utcnow()
                user.expires_at = cls._add_months(now, 1)
            else:
                user.expires_at = None  # Бессрочно для free
            
            # Для API тарифа сохраняем ключ
            if new_tier == "api" and api_key:
                user.api_key = api_key
            
            # Сбрасываем счетчик использованных сообщений при смене тарифа
            user.messages_used = 0
            
            # Обновляем время последнего изменения
            user.updated_at = datetime.utcnow()
            
            # Сохраняем изменения
            db.add(user)
            db.commit()
            db.refresh(user)
            
            logger.info(f"User {user.id} upgraded from {old_tier} to {new_tier}")
            
            return {
                "success": True,
                "message": f"Подписка успешно обновлена до {new_tier}",
                "subscription_tier": new_tier,
                "messages_limit": config["messages_limit"],
                "expires_at": user.expires_at.isoformat() if user.expires_at else None,
                "price": config["price"]
            }
            
        except Exception as e:
            logger.error(f"Error upgrading subscription for user {user.id}: {e}", exc_info=True)
            db.rollback()
            return {
                "success": False,
                "message": "Ошибка при обновлении подписки",
                "error": "UPGRADE_FAILED"
            }
    
    @classmethod
    def check_subscription_status(cls, user: User, db: Optional[Session] = None) -> dict:
        """
        Проверить статус подписки пользователя
        
        Args:
            user: Пользователь
            db: Сессия базы данных (опционально, нужна для сброса цикла)
        
        Returns:
            dict: Статус подписки
        """
        try:
            # Обеспечиваем цикл сброса сообщений, если предоставлена сессия БД
            if db:
                cls.ensure_message_cycle(db, user)
            
            is_expired = False
            days_remaining = None
            
            if user.expires_at:
                now = datetime.utcnow()
                if user.expires_at < now:
                    is_expired = True
                    # Если подписка истекла, возвращаем к free тарифу
                    if user.subscription_tier != "free":
                        user.subscription_tier = "free"
                        user.messages_limit = cls.SUBSCRIPTION_CONFIGS["free"]["messages_limit"]
                        user.api_access = False
                        user.api_key = None
                        user.expires_at = None
                        user.messages_used = 0  # Сбрасываем счетчик сообщений
                        user.updated_at = datetime.utcnow()
                        if db:
                            db.add(user)
                            db.commit()
                        logger.info(f"User {user.id} subscription expired, downgraded to free")
                else:
                    days_remaining = (user.expires_at - now).days
            
            return {
                "subscription_tier": user.subscription_tier,
                "is_expired": is_expired,
                "expires_at": user.expires_at.isoformat() if user.expires_at else None,
                "days_remaining": days_remaining,
                "messages_used": user.messages_used,
                "messages_limit": user.messages_limit,
                "api_access": user.api_access,
                "can_upgrade": user.subscription_tier in ["free", "plus"],
                "can_downgrade": user.subscription_tier in ["plus", "pro", "api"]
            }
            
        except Exception as e:
            logger.error(f"Error checking subscription status for user {user.id}: {e}", exc_info=True)
            return {
                "subscription_tier": "free",
                "is_expired": False,
                "expires_at": None,
                "days_remaining": None,
                "messages_used": 0,
                "messages_limit": 50,
                "api_access": False,
                "can_upgrade": True,
                "can_downgrade": False
            }
    
    @classmethod
    def initialize_user_subscription(cls, user: User) -> None:
        """
        Инициализировать подписку для нового пользователя
        
        Args:
            user: Пользователь
        """
        if not user.subscription_tier:
            user.subscription_tier = "free"
            config = cls.get_subscription_config("free")
            user.messages_limit = config["messages_limit"]
            user.api_access = config["api_access"]
            user.messages_used = 0
            user.expires_at = None
            logger.info(f"Initialized subscription for new user {user.id}")
    
    
    @classmethod
    def ensure_message_cycle(cls, db: Session, user: User) -> bool:
        """
        Обеспечить цикл сброса сообщений для пользователя
        
        Для всех тарифов: ежедневный сброс сообщений в 00:00 UTC
        Подписка pro истекает через месяц (через expires_at)
        
        Args:
            db: Сессия базы данных
            user: Пользователь
            
        Returns:
            bool: Была ли выполнена ротация цикла
        """
        try:
            now = datetime.utcnow()
            
            # Инициализация начала цикла
            if not getattr(user, "messages_cycle_started_at", None):
                # Используем начало текущего дня (00:00 UTC)
                base = getattr(user, "created_at", None) or now
                user.messages_cycle_started_at = base.replace(hour=0, minute=0, second=0, microsecond=0)
                user.messages_used = 0
                db.add(user)
                db.commit()
                logger.info(f"Initialized daily message cycle for user {user.id} at {user.messages_cycle_started_at}")
                return True
            
            # Для всех тарифов: ежедневный сброс в 00:00 UTC
            cycle_start = user.messages_cycle_started_at.replace(hour=0, minute=0, second=0, microsecond=0)
            now_normalized = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Проверяем, прошел ли хотя бы один день
            if now_normalized > cycle_start:
                days_passed = (now_normalized - cycle_start).days
                if days_passed >= 1:
                    # Сбрасываем счетчик и обновляем начало цикла на текущий день
                    user.messages_cycle_started_at = now_normalized
                    user.messages_used = 0
                    db.add(user)
                    db.commit()
                    logger.info(f"Reset daily message cycle for user {user.id} ({user.subscription_tier} tier): "
                              f"days_passed={days_passed}, new_cycle_start={now_normalized}, reset messages_used to 0")
                    return True

            # Одноразовая синхронизация: если messages_used 0, но в БД есть сообщения за сегодня
            used = getattr(user, "messages_used", 0) or 0
            if used == 0:
                db_count = cls.get_all_messages_count_today(db, user)
                if db_count > 0:
                    user.messages_used = db_count
                    db.add(user)
                    db.commit()
                    logger.info(f"Synced messages_used for user {user.id} from DB: {db_count}")
            
            return False
        except Exception as e:
            logger.warning(f"Failed to ensure message cycle for user {getattr(user,'id',None)}: {e}", exc_info=True)
        
        return False

    @classmethod
    def get_all_messages_count_today(cls, db: Session, user: User) -> int:
        """
        Получить общее количество всех сообщений (пользователя + агентов) за текущий день
        
        Args:
            db: Сессия базы данных
            user: Пользователь
        
        Returns:
            int: Количество всех сообщений за текущий день
        """
        
        now = datetime.utcnow()
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Считаем сообщения из обычных чатов (исключаем системные чаты)
        regular_messages = db.exec(
            select(func.count(Message.id))
            .join(Conversation)
            .where(
                Conversation.user_id == user.id,
                Message.created_at >= period_start,
                Conversation.is_system_chat == False  # Исключаем системные чаты из лимита
            )
        ).first() or 0
        
        # Считаем сообщения из групповых чатов
        multi_agent_messages = db.exec(
            select(func.count(Message.id))
            .join(MultiAgentConversation)
            .where(
                MultiAgentConversation.user_id == user.id,
                Message.created_at >= period_start
            )
        ).first() or 0
        
        return regular_messages + multi_agent_messages

    @classmethod
    def record_message_sent(cls, session: Session, user_id: int) -> None:
        """
        Записать отправку сообщения (увеличивает messages_used).
        Используется для статистики и лимита. Счётчик не уменьшается при удалении чатов.
        """
        try:
            user = session.get(User, user_id)
            if not user:
                return
            cls.ensure_message_cycle(session, user)
            user.messages_used = (getattr(user, "messages_used", 0) or 0) + 1
            session.add(user)
            session.commit()
        except Exception as e:
            logger.warning(f"Failed to record message sent for user {user_id}: {e}", exc_info=True)
            session.rollback()

    @classmethod
    def can_send_message(cls, user: User, db: Session) -> bool:
        """
        Проверить, может ли пользователь отправить сообщение.
        Использует messages_used (не уменьшается при удалении чатов).
        """
        subscription_status = cls.check_subscription_status(user, db)
        if subscription_status["is_expired"]:
            logger.debug(f"Subscription expired for user {user.id}")
            return False
        if user.messages_limit == -1:
            logger.debug(f"Unlimited messages for user {user.id}")
            return True
        used = getattr(user, "messages_used", 0) or 0
        can_send = used < user.messages_limit
        logger.debug(f"User {user.id} can send message: {can_send} (messages_used={used}, limit={user.messages_limit})")
        return can_send
    
    @classmethod
    def increment_message_count(cls, db: Session, user: User) -> bool:
        """
        Проверить, может ли пользователь отправить сообщение
        Проверяет общее количество всех сообщений (пользователя + агентов) за день
        Счетчик messages_used больше не используется для проверки лимита
        
        Args:
            db: Сессия базы данных
            user: Пользователь
        
        Returns:
            bool: Может ли отправить сообщение (не превышен лимит)
        """
        try:
            logger.debug(f"Checking message limit for user {user.id}: limit={user.messages_limit}")
            
            # Обеспечиваем цикл сброса сообщений перед проверкой
            cls.ensure_message_cycle(db, user)
            
            # Проверяем, может ли пользователь отправить сообщение
            # (считаются все сообщения за день: пользователя + агентов)
            if cls.can_send_message(user, db):
                # Обновляем updated_at для синхронизации
                user.updated_at = datetime.utcnow()
                db.add(user)
                db.commit()
                logger.debug(f"User {user.id} can send message")
                return True
            else:
                used = getattr(user, "messages_used", 0) or 0
                logger.warning(f"Cannot send message for user {user.id}: limit exceeded (messages_used={used}, limit={user.messages_limit})")
                return False
        except Exception as e:
            logger.error(f"Error checking message limit for user {user.id}: {e}", exc_info=True)
            db.rollback()
            return False

