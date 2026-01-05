#!/usr/bin/env python3
"""
Скрипт для диагностики групповых чатов (MultiAgentConversation)

Проверяет:
- Есть ли групповые чаты без user_id
- Правильно ли привязаны чаты к пользователям
- Соответствие данных в БД ожидаемому состоянию
"""
import os
import sys
from sqlmodel import Session, select

# Ensure backend package is on sys.path
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.multi_agent_conversation import MultiAgentConversation
from models.user import User


def check_multi_agent_conversations():
    """Проверить состояние групповых чатов в базе данных"""
    create_db_and_tables()
    
    print("=" * 60)
    print("ПРОВЕРКА ГРУППОВЫХ ЧАТОВ (MultiAgentConversation)")
    print("=" * 60)
    
    with Session(engine) as session:
        # 1. Получаем все групповые чаты
        all_conversations = session.exec(select(MultiAgentConversation)).all()
        print(f"\n📊 Всего групповых чатов в БД: {len(all_conversations)}")
        
        if not all_conversations:
            print("✅ Групповых чатов нет")
            return
        
        # 2. Проверяем, есть ли чаты без user_id
        conversations_without_user = [
            conv for conv in all_conversations 
            if conv.user_id is None
        ]
        
        if conversations_without_user:
            print(f"\n⚠️  НАЙДЕНО {len(conversations_without_user)} ЧАТОВ БЕЗ user_id:")
            for conv in conversations_without_user:
                print(f"  - Чат ID {conv.id}: title='{conv.title}', user_id={conv.user_id}")
        else:
            print(f"\n✅ Все групповые чаты имеют user_id")
        
        # 3. Группируем чаты по пользователям
        conversations_by_user = {}
        for conv in all_conversations:
            user_id = conv.user_id
            if user_id is None:
                user_id = "None"
            
            if user_id not in conversations_by_user:
                conversations_by_user[user_id] = []
            conversations_by_user[user_id].append(conv)
        
        print(f"\n📊 Распределение чатов по пользователям:")
        print(f"   Всего уникальных user_id: {len(conversations_by_user)}")
        
        # 4. Проверяем существование пользователей
        users = session.exec(select(User)).all()
        user_ids_set = {u.id for u in users}
        
        print(f"\n👥 Пользователи в системе: {len(users)}")
        for user_id, convs in sorted(conversations_by_user.items()):
            if user_id == "None":
                status = "❌ НЕТ USER_ID"
            elif user_id not in user_ids_set:
                status = f"❌ ПОЛЬЗОВАТЕЛЬ {user_id} НЕ СУЩЕСТВУЕТ"
            else:
                user = session.get(User, user_id)
                status = f"✅ Пользователь {user.username if user else '?'}"
            
            print(f"  user_id={user_id}: {len(convs)} чатов - {status}")
            for conv in convs:
                print(f"    - Чат ID {conv.id}: '{conv.title}' (создан {conv.created_at})")
        
        # 5. Статистика
        print(f"\n📈 Статистика:")
        print(f"  - Всего чатов: {len(all_conversations)}")
        print(f"  - Чатов без user_id: {len(conversations_without_user)}")
        print(f"  - Чатов с несуществующими user_id: {sum(1 for uid in conversations_by_user.keys() if uid != 'None' and uid not in user_ids_set)}")
        print(f"  - Чатов с валидными user_id: {len(all_conversations) - len(conversations_without_user) - sum(1 for uid in conversations_by_user.keys() if uid != 'None' and uid not in user_ids_set)}")


if __name__ == "__main__":
    check_multi_agent_conversations()

