"""Скрипт для принудительной очистки всех дубликатов каналов."""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlmodel import Session, select, func
from core.database import engine
from models.conversation import Conversation
from models.user_channel_subscription import UserChannelSubscription
from models.message import Message

def force_cleanup_duplicates():
    """Принудительно удалить все дубликаты каналов."""
    with Session(engine) as session:
        # Находим все каналы
        all_channels = session.exec(
            select(Conversation).where(Conversation.is_channel == True)  # noqa: E712
        ).all()
        
        print(f"\nВсего каналов в базе: {len(all_channels)}")
        
        # Группируем по названию (для системных каналов с одинаковым названием - это дубликаты)
        # Для новостных каналов группируем только по title, так как они должны быть уникальными по названию
        channels_by_title = {}
        for channel in all_channels:
            title = (channel.title or "").lower().strip()
            if not title:
                continue
            
            if title not in channels_by_title:
                channels_by_title[title] = []
            channels_by_title[title].append(channel)
        
        total_removed = 0
        # Удаляем дубликаты
        for title, channels in channels_by_title.items():
            if len(channels) > 1:
                print(f"\nНайдено {len(channels)} дубликатов для канала '{title}'")
                
                # Сортируем по created_at (самый старый первый)
                channels = sorted(channels, key=lambda c: c.created_at or None)
                
                # Оставляем первый (самый старый), удаляем остальные
                for i, duplicate in enumerate(channels[1:], 1):
                    print(f"  Удаление дубликата {i}/{len(channels)-1}: ID={duplicate.id}, created_at={duplicate.created_at}")
                    
                    # Удаляем подписки на дубликат
                    subscriptions = session.exec(
                        select(UserChannelSubscription).where(
                            UserChannelSubscription.channel_id == duplicate.id
                        )
                    ).all()
                    for sub in subscriptions:
                        # Переносим подписку на основной канал
                        main_channel_id = channels[0].id
                        existing_sub = session.exec(
                            select(UserChannelSubscription).where(
                                (UserChannelSubscription.channel_id == main_channel_id)
                                & (UserChannelSubscription.user_id == sub.user_id)
                            )
                        ).first()
                        if not existing_sub:
                            new_sub = UserChannelSubscription(
                                channel_id=main_channel_id,
                                user_id=sub.user_id,
                            )
                            session.add(new_sub)
                        session.delete(sub)
                    
                    # Удаляем сообщения дубликата
                    messages = session.exec(
                        select(Message).where(Message.conversation_id == duplicate.id)
                    ).all()
                    for msg in messages:
                        session.delete(msg)
                    
                    # Удаляем сам канал
                    session.delete(duplicate)
                    total_removed += 1
        
        session.commit()
        print(f"\nУдалено {total_removed} дубликатов каналов")
        print(f"Осталось каналов: {len(all_channels) - total_removed}")

if __name__ == "__main__":
    force_cleanup_duplicates()

