#!/usr/bin/env python3
"""
Скрипт для сброса счетчиков сообщений для всех пользователей
Сбрасывает messages_used в 0 и устанавливает messages_cycle_started_at на начало текущего дня
"""

import sys
import os

# Добавляем корневую директорию проекта в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from core.database import engine
from models.user import User
from datetime import datetime

def reset_all_message_counters():
    """Сбросить счетчики сообщений для всех пользователей"""
    try:
        with Session(engine) as session:
            # Получаем всех пользователей
            users = session.exec(select(User)).all()
            total_users = len(users)
            
            if total_users == 0:
                print("Пользователи не найдены")
                return
            
            print(f"Найдено пользователей: {total_users}")
            
            # Вычисляем начало текущего дня в UTC
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            reset_count = 0
            for user in users:
                old_used = user.messages_used
                old_cycle = user.messages_cycle_started_at
                
                # Сбрасываем счетчик и устанавливаем начало цикла на сегодня
                user.messages_used = 0
                user.messages_cycle_started_at = today_start
                user.updated_at = now
                
                reset_count += 1
                
                if reset_count <= 5:  # Показываем первые 5 для примера
                    print(f"  User {user.id} ({user.username}): messages_used {old_used} -> 0, "
                          f"cycle_started {old_cycle} -> {today_start}")
            
            # Сохраняем изменения
            session.commit()
            
            print(f"\n✅ Успешно сброшены счетчики для {reset_count} пользователей")
            print(f"   Дата начала цикла установлена на: {today_start}")
            
    except Exception as e:
        print(f"❌ Ошибка при сбросе счетчиков: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    print("🔄 Сброс счетчиков сообщений для всех пользователей...")
    print("=" * 60)
    
    if reset_all_message_counters():
        print("=" * 60)
        print("✅ Сброс счетчиков завершен успешно")
        sys.exit(0)
    else:
        print("=" * 60)
        print("❌ Сброс счетчиков завершился с ошибкой")
        sys.exit(1)

