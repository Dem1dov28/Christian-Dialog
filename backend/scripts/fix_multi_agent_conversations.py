#!/usr/bin/env python3
"""
Скрипт для диагностики и исправления групповых чатов (MultiAgentConversation)

Проверяет и исправляет:
- Групповые чаты без user_id (можно удалить или привязать к первому пользователю)
- Групповые чаты с несуществующими user_id
- Неправильные привязки чатов к пользователям
"""
import os
import sys
from sqlmodel import Session, select
from typing import List, Dict

# Ensure backend package is on sys.path
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.multi_agent_conversation import MultiAgentConversation
from models.user import User
from models.message import Message


def diagnose_problems(session: Session) -> Dict:
    """Диагностика проблем в базе данных"""
    print("=" * 60)
    print("ДИАГНОСТИКА ГРУППОВЫХ ЧАТОВ")
    print("=" * 60)
    
    # Получаем все групповые чаты
    all_conversations = session.exec(select(MultiAgentConversation)).all()
    print(f"\n📊 Всего групповых чатов в БД: {len(all_conversations)}")
    
    # Получаем всех пользователей
    users = session.exec(select(User)).all()
    user_ids_set = {u.id for u in users}
    print(f"👥 Всего пользователей в системе: {len(users)}")
    
    problems = {
        'without_user_id': [],
        'invalid_user_id': [],
        'valid': []
    }
    
    for conv in all_conversations:
        if conv.user_id is None:
            problems['without_user_id'].append(conv)
        elif conv.user_id not in user_ids_set:
            problems['invalid_user_id'].append(conv)
        else:
            problems['valid'].append(conv)
    
    # Выводим результаты диагностики
    print(f"\n📋 Результаты диагностики:")
    print(f"  ✅ Валидных чатов: {len(problems['valid'])}")
    print(f"  ⚠️  Чатов без user_id: {len(problems['without_user_id'])}")
    print(f"  ❌ Чатов с несуществующими user_id: {len(problems['invalid_user_id'])}")
    
    if problems['without_user_id']:
        print(f"\n⚠️  Чаты без user_id:")
        for conv in problems['without_user_id']:
            # Проверяем, есть ли сообщения в этом чате
            messages_count = session.exec(
                select(Message).where(Message.multi_agent_conversation_id == conv.id)
            ).all()
            print(f"  - Чат ID {conv.id}: '{conv.title}' (создан {conv.created_at}), сообщений: {len(messages_count)}")
    
    if problems['invalid_user_id']:
        print(f"\n❌ Чаты с несуществующими user_id:")
        for conv in problems['invalid_user_id']:
            messages_count = session.exec(
                select(Message).where(Message.multi_agent_conversation_id == conv.id)
            ).all()
            print(f"  - Чат ID {conv.id}: user_id={conv.user_id} (не существует), '{conv.title}', сообщений: {len(messages_count)}")
    
    # Показываем распределение по пользователям
    print(f"\n📊 Распределение валидных чатов по пользователям:")
    valid_by_user = {}
    for conv in problems['valid']:
        if conv.user_id not in valid_by_user:
            valid_by_user[conv.user_id] = []
        valid_by_user[conv.user_id].append(conv)
    
    for user_id, convs in sorted(valid_by_user.items()):
        user = session.get(User, user_id)
        username = user.username if user else '?'
        print(f"  user_id={user_id} ({username}): {len(convs)} чатов")
    
    return problems


def fix_problems(session: Session, problems: Dict, delete_orphaned: bool = False) -> int:
    """Исправление проблем в базе данных"""
    print("\n" + "=" * 60)
    print("ИСПРАВЛЕНИЕ ПРОБЛЕМ")
    print("=" * 60)
    
    fixed_count = 0
    
    # Получаем всех пользователей
    users = session.exec(select(User)).all()
    if not users:
        print("❌ Нет пользователей в системе. Невозможно исправить чаты.")
        return 0
    
    first_user_id = users[0].id
    print(f"📌 Первый пользователь для привязки: user_id={first_user_id}")
    
    # Исправляем чаты без user_id
    if problems['without_user_id']:
        print(f"\n🔧 Исправление {len(problems['without_user_id'])} чатов без user_id...")
        for conv in problems['without_user_id']:
            if delete_orphaned:
                # Удаляем чат и все его сообщения
                messages = session.exec(
                    select(Message).where(Message.multi_agent_conversation_id == conv.id)
                ).all()
                for msg in messages:
                    session.delete(msg)
                session.delete(conv)
                print(f"  🗑️  Удален чат ID {conv.id}: '{conv.title}'")
            else:
                # Привязываем к первому пользователю
                old_user_id = conv.user_id
                conv.user_id = first_user_id
                session.add(conv)
                print(f"  ✅ Чат ID {conv.id}: user_id={old_user_id} -> {first_user_id}")
            fixed_count += 1
    
    # Исправляем чаты с несуществующими user_id
    if problems['invalid_user_id']:
        print(f"\n🔧 Исправление {len(problems['invalid_user_id'])} чатов с несуществующими user_id...")
        for conv in problems['invalid_user_id']:
            if delete_orphaned:
                # Удаляем чат и все его сообщения
                messages = session.exec(
                    select(Message).where(Message.multi_agent_conversation_id == conv.id)
                ).all()
                for msg in messages:
                    session.delete(msg)
                session.delete(conv)
                print(f"  🗑️  Удален чат ID {conv.id}: '{conv.title}' (user_id={conv.user_id} не существует)")
            else:
                # Привязываем к первому пользователю
                old_user_id = conv.user_id
                conv.user_id = first_user_id
                session.add(conv)
                print(f"  ✅ Чат ID {conv.id}: user_id={old_user_id} -> {first_user_id}")
            fixed_count += 1
    
    if fixed_count > 0:
        session.commit()
        print(f"\n✅ Исправлено {fixed_count} чатов")
    else:
        print("\n✅ Проблем для исправления не найдено")
    
    return fixed_count


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Диагностика и исправление групповых чатов')
    parser.add_argument('--fix', action='store_true', help='Исправить проблемы автоматически')
    parser.add_argument('--delete-orphaned', action='store_true', 
                       help='Удалить чаты без валидного user_id (по умолчанию привязываются к первому пользователю)')
    args = parser.parse_args()
    
    create_db_and_tables()
    
    with Session(engine) as session:
        # Диагностика
        problems = diagnose_problems(session)
        
        # Исправление (если нужно)
        if args.fix:
            print("\n" + "⚠️" * 30)
            print("ВНИМАНИЕ: Будут внесены изменения в базу данных!")
            if not args.delete_orphaned:
                print("Чаты без user_id будут привязаны к первому пользователю.")
            else:
                print("Чаты без валидного user_id будут УДАЛЕНЫ вместе с сообщениями!")
            print("⚠️" * 30)
            
            confirm = input("\nПродолжить? (yes/no): ").strip().lower()
            if confirm in ['yes', 'y', 'да']:
                fix_problems(session, problems, delete_orphaned=args.delete_orphaned)
            else:
                print("❌ Отменено пользователем")
        else:
            print("\n💡 Для исправления запустите скрипт с флагом --fix")
            print("   Пример: python scripts/fix_multi_agent_conversations.py --fix")


if __name__ == "__main__":
    main()

