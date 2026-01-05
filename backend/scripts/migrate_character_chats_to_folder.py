#!/usr/bin/env python3
"""
Скрипт для миграции всех чатов с персонажами в системную папку 'Персонажи'

Находит все разговоры (Conversation) с агентами категории 'chats' и добавляет их
в системную папку 'Персонажи' для каждого пользователя, если их там еще нет.
"""
import os
import sys
from sqlmodel import Session, select, and_
from typing import List, Set

# Ensure backend package is on sys.path
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.agent import Agent
from models.conversation import Conversation
from models.folder import Folder


def migrate_character_chats_to_folder():
    """Мигрировать все чаты с персонажами в папку 'Персонажи'."""
    create_db_and_tables()
    
    with Session(engine) as session:
        # 1. Найти всех агентов-персонажей (category == "chats")
        character_agents = session.exec(
            select(Agent).where(
                Agent.category == "chats"
            )
        ).all()
        
        if not character_agents:
            print("❌ Не найдено агентов категории 'chats'")
            return
        
        agent_ids_set: Set[int] = {a.id for a in character_agents}
        print(f"✅ Найдено {len(agent_ids_set)} персонажей: {[a.name for a in character_agents]}")
        
        # 2. Найти все чаты с этими агентами
        character_conversations = session.exec(
            select(Conversation).where(
                Conversation.agent_id.in_(list(agent_ids_set))
            ).where(
                Conversation.is_system_chat == False
            )
        ).all()
        
        if not character_conversations:
            print("⚠️  Не найдено чатов с персонажами")
            return
        
        print(f"✅ Найдено {len(character_conversations)} чатов с персонажами")
        
        # 3. Группируем чаты по пользователям
        user_chats: dict[int, List[int]] = {}
        for conv in character_conversations:
            if conv.user_id not in user_chats:
                user_chats[conv.user_id] = []
            user_chats[conv.user_id].append(conv.id)
        
        print(f"✅ Чаты распределены по {len(user_chats)} пользователям")
        
        # 4. Для каждого пользователя обновляем папку 'Персонажи'
        total_added = 0
        total_updated = 0
        
        for user_id, chat_ids in user_chats.items():
            # Найти папку 'Персонажи' для этого пользователя
            folder = session.exec(
                select(Folder).where(
                    and_(
                        Folder.user_id == user_id,
                        Folder.folder_type == "system",
                        Folder.name == "Персонажи"
                    )
                )
            ).first()
            
            if not folder:
                print(f"⚠️  У пользователя {user_id} нет папки 'Персонажи', создаём...")
                folder = Folder(
                    name="Персонажи",
                    description="Чаты с персонажами",
                    folder_type="system",
                    icon="psychology",
                    color="bg-purple-500",
                    is_pinned=True,
                    sort_order=1,
                    user_id=user_id,
                    chat_ids="[]",
                    agent_ids="[]",
                    settings="{}"
                )
                session.add(folder)
                session.flush()
            
            # Получить текущие chat_ids из папки
            existing_chat_ids = folder.get_chat_ids()
            existing_set = set(existing_chat_ids)
            
            # Добавить новые чаты в начало списка
            added_count = 0
            for chat_id in chat_ids:
                if chat_id not in existing_set:
                    existing_chat_ids.insert(0, chat_id)
                    existing_set.add(chat_id)
                    added_count += 1
            
            if added_count > 0:
                folder.set_chat_ids(existing_chat_ids)
                session.add(folder)
                total_added += added_count
                total_updated += 1
                print(f"  ✅ Пользователь {user_id}: добавлено {added_count} чатов в папку 'Персонажи'")
        
        if total_added > 0:
            session.commit()
            print(f"\n✅ Миграция завершена!")
            print(f"   Обновлено папок: {total_updated}")
            print(f"   Добавлено чатов: {total_added}")
        else:
            print("\nℹ️  Все чаты уже находятся в папках 'Персонажи'")


if __name__ == "__main__":
    print("=" * 80)
    print("🔄 МИГРАЦИЯ ЧАТОВ С ПЕРСОНАЖАМИ В ПАПКУ 'ПЕРСОНАЖИ'")
    print("=" * 80)
    print()
    migrate_character_chats_to_folder()
