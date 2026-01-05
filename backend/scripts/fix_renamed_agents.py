#!/usr/bin/env python3
"""
Скрипт для исправления переименованных агентов и удаления удаленных персонажей
"""

import os
import sys

# Настройка кодировки для вывода в Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sqlmodel import Session, select
from core.database import engine, create_db_and_tables
from models.agent import Agent
from models.conversation import Conversation
from models.multi_agent_conversation import ConversationAgent
from models.message import Message
from models.test_answer import TestAnswer

# Маппинг старых имен на новые
RENAME_MAP = {
    "Владимир Ильич Ленин": "Владимир Ленин",
    "Иосиф Виссарионович Сталин": "Иосиф Сталин",
    "Иисус из Назарета": "Иисус",
    "Будда (Просветленный)": "Будда",
}

# Агенты для удаления
DELETE_AGENTS = [
    "Дарт Вэйдер",
    "Гарри Поттер",
    "Darth Vader",
    "Harry Potter",
]


def fix_renamed_agents():
    """Переименовать агентов"""
    create_db_and_tables()
    
    with Session(engine) as session:
        renamed_count = 0
        
        for old_name, new_name in RENAME_MAP.items():
            # Проверяем, существует ли агент со старым именем
            old_agent = session.exec(
                select(Agent).where(Agent.name == old_name)
            ).first()
            
            if old_agent:
                # Проверяем, существует ли агент с новым именем
                new_agent = session.exec(
                    select(Agent).where(Agent.name == new_name)
                ).first()
                
                if new_agent:
                    print(f"⚠️  Агент с именем '{new_name}' уже существует (ID: {new_agent.id})")
                    print(f"   Перемещаю связанные данные со старого агента '{old_name}' (ID: {old_agent.id})")
                    
                    # Перемещаем conversations
                    conversations = session.exec(
                        select(Conversation).where(Conversation.agent_id == old_agent.id)
                    ).all()
                    for conv in conversations:
                        conv.agent_id = new_agent.id
                        session.add(conv)
                    
                    # Перемещаем conversation agents (multi-agent)
                    conv_agents = session.exec(
                        select(ConversationAgent).where(ConversationAgent.agent_id == old_agent.id)
                    ).all()
                    for conv_agent in conv_agents:
                        conv_agent.agent_id = new_agent.id
                        session.add(conv_agent)
                    
                    # Перемещаем messages
                    messages = session.exec(
                        select(Message).where(Message.agent_id == old_agent.id)
                    ).all()
                    for msg in messages:
                        msg.agent_id = new_agent.id
                        session.add(msg)
                    
                    # Перемещаем test answers
                    test_answers = session.exec(
                        select(TestAnswer).where(TestAnswer.agent_id == old_agent.id)
                    ).all()
                    for test in test_answers:
                        test.agent_id = new_agent.id
                        session.add(test)
                    
                    session.commit()
                    
                    # Теперь можно удалить старого агента
                    print(f"   Удаляю старого агента '{old_name}' (ID: {old_agent.id})")
                    session.delete(old_agent)
                    session.commit()
                    renamed_count += 1
                else:
                    print(f"🔄 Переименовываю '{old_name}' -> '{new_name}' (ID: {old_agent.id})")
                    old_agent.name = new_name
                    session.add(old_agent)
                    session.commit()
                    renamed_count += 1
            else:
                print(f"⏭️  Агент '{old_name}' не найден, пропускаю")
        
        print(f"\n✅ Переименовано: {renamed_count} агентов")


def delete_removed_agents():
    """Удалить агентов, которые были удалены из конфигурации"""
    create_db_and_tables()
    
    with Session(engine) as session:
        deleted_count = 0
        
        for agent_name in DELETE_AGENTS:
            agent = session.exec(
                select(Agent).where(Agent.name == agent_name)
            ).first()
            
            if agent:
                print(f"🗑️  Удаляю агента '{agent_name}' (ID: {agent.id})")
                
                # Подсчитываем связанные данные
                conversations_count = session.exec(
                    select(Conversation).where(Conversation.agent_id == agent.id)
                ).all()
                conv_agents_count = session.exec(
                    select(ConversationAgent).where(ConversationAgent.agent_id == agent.id)
                ).all()
                
                if conversations_count or conv_agents_count:
                    print(f"   Внимание: найдено {len(conversations_count)} conversations и {len(conv_agents_count)} multi-agent связей")
                    print(f"   Помечаю агента как неактивного (is_active=False) вместо удаления")
                    agent.is_active = False
                    session.add(agent)
                    session.commit()
                else:
                    # Если нет связанных данных, можно безопасно удалить
                    print(f"   Нет связанных данных, безопасно удаляю агента")
                    session.delete(agent)
                    session.commit()
                    deleted_count += 1
            else:
                print(f"⏭️  Агент '{agent_name}' не найден, пропускаю")
        
        print(f"\n✅ Удалено: {deleted_count} агентов")


def main():
    """Главная функция"""
    print("=" * 80)
    print("🔧 ИСПРАВЛЕНИЕ ПЕРЕИМЕНОВАННЫХ И УДАЛЕННЫХ АГЕНТОВ")
    print("=" * 80)
    
    print("\n1️⃣ Переименование агентов:")
    print("-" * 80)
    fix_renamed_agents()
    
    print("\n2️⃣ Удаление удаленных агентов:")
    print("-" * 80)
    delete_removed_agents()
    
    print("\n" + "=" * 80)
    print("✅ Готово!")
    print("=" * 80)
    print("\n💡 Теперь запустите sync_agents_from_config.py для синхронизации изменений")


if __name__ == "__main__":
    main()

