"""Скрипт для проверки подписок пользователей на каналы."""
import sys
import os

# Добавляем корневую директорию проекта в путь
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select, func
from core.database import engine
from models.conversation import Conversation
from models.user_channel_subscription import UserChannelSubscription
from models.user import User

def check_user_subscriptions():
    """Проверить подписки пользователей на каналы."""
    with Session(engine) as session:
        # Получаем всех пользователей
        users = session.exec(select(User)).all()
        
        print(f"\nTotal users: {len(users)}")
        
        for user in users:
            # Получаем подписки пользователя
            subscriptions = session.exec(
                select(UserChannelSubscription).where(
                    UserChannelSubscription.user_id == user.id
                )
            ).all()
            
            if not subscriptions:
                continue
            
            print(f"\nUser ID: {user.id}, Username: {user.username}")
            print(f"  Total subscriptions: {len(subscriptions)}")
            
            # Группируем подписки по названию канала
            channels_by_title = {}
            for sub in subscriptions:
                channel = session.get(Conversation, sub.channel_id)
                if channel:
                    title = channel.title.lower() if channel.title else ""
                    if title not in channels_by_title:
                        channels_by_title[title] = []
                    channels_by_title[title].append({
                        "channel_id": channel.id,
                        "channel_title": channel.title,
                        "subscription_id": sub.id,
                    })
            
            # Проверяем дубликаты подписок
            for title, channel_subs in channels_by_title.items():
                if len(channel_subs) > 1:
                    print(f"\n  WARNING: User {user.id} subscribed to {len(channel_subs)} channels with same title '{title}':")
                    for sub_info in channel_subs:
                        print(f"    - Channel ID: {sub_info['channel_id']}, Title: {sub_info['channel_title']}, Subscription ID: {sub_info['subscription_id']}")

if __name__ == "__main__":
    check_user_subscriptions()

