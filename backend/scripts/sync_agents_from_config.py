#!/usr/bin/env python3
"""
Скрипт для синхронизации агентов из YAML конфигурации в базу данных.
Позволяет версионировать промпты в git и легко обновлять их.
"""

import os
import sys
import yaml
from dotenv import load_dotenv
from sqlmodel import Session, select

# Настройка кодировки для вывода в Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Для старых версий Python
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Ensure backend package is on sys.path when running this script directly
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load .env (needed because core.database requires DATABASE_URL)
try:
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except Exception:
    # If dotenv isn't available or .env missing, continue; core.database will raise a clear error.
    pass

from core.database import engine, create_db_and_tables
from models.agent import Agent
from models.multi_agent_conversation import ConversationAgent


def load_agents_config(config_path: str = None) -> list:
    """Загрузить конфигурацию агентов из YAML файла"""
    if config_path is None:
        config_path = os.path.join(PROJECT_ROOT, "config", "agents.yaml")
    
    if not os.path.exists(config_path):
        print(f"❌ Файл конфигурации не найден: {config_path}")
        return []
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    return config.get('agents', [])


def sync_agents_from_config(dry_run: bool = False, remove_orphans: bool = False):
    """Синхронизировать агентов из конфигурации в БД"""
    create_db_and_tables()
    
    agents_config = load_agents_config()
    if not agents_config:
        print("❌ Нет агентов в конфигурации")
        return
    
    print(f"📋 Найдено {len(agents_config)} агентов в конфигурации\n")
    
    with Session(engine) as session:
        updated_count = 0
        created_count = 0
        removed_count = 0
        
        # Get all agent names from config
        config_agent_names = {agent['name'] for agent in agents_config}
        
        # Find and remove orphaned global agents if flag is set
        # Only remove agents with user_id=NULL (global/system agents)
        # User-created agents (user_id != NULL) are never deleted
        if remove_orphans:
            all_db_agents = session.exec(select(Agent)).all()
            for db_agent in all_db_agents:
                # Skip user-created agents (they have user_id set)
                if db_agent.user_id is not None:
                    continue
                # Only remove global agents that are not in config
                if db_agent.name not in config_agent_names:
                    if not dry_run:
                        # First, delete all ConversationAgent records referencing this agent
                        conversation_agents = session.exec(
                            select(ConversationAgent).where(ConversationAgent.agent_id == db_agent.id)
                        ).all()
                        for ca in conversation_agents:
                            session.delete(ca)
                        # Now delete the agent
                        session.delete(db_agent)
                        session.commit()
                    print(f"🗑️  Удален: {db_agent.name} (ID: {db_agent.id})")
                    removed_count += 1
            if removed_count > 0:
                print()
        
        for agent_config in agents_config:
            name = agent_config['name']
            
            # Ищем существующего агента
            existing = session.exec(
                select(Agent).where(Agent.name == name)
            ).first()
            
            if existing:
                # Обновляем существующего агента
                changed = False
                
                if existing.instructions != agent_config.get('instructions', ''):
                    existing.instructions = agent_config.get('instructions', '')
                    changed = True
                
                if existing.model != agent_config.get('model', 'deepseek/deepseek-chat'):
                    existing.model = agent_config.get('model', 'deepseek/deepseek-chat')
                    changed = True
                
                if existing.category != agent_config.get('category', 'general'):
                    existing.category = agent_config.get('category', 'general')
                    changed = True
                
                if existing.description != agent_config.get('description'):
                    existing.description = agent_config.get('description')
                    changed = True
                
                if existing.icon_name != agent_config.get('icon_name'):
                    existing.icon_name = agent_config.get('icon_name')
                    changed = True
                
                if existing.color_class != agent_config.get('color_class'):
                    existing.color_class = agent_config.get('color_class')
                    changed = True
                
                if existing.is_active != agent_config.get('is_active', True):
                    existing.is_active = agent_config.get('is_active', True)
                    changed = True
                
                # Обновляем available_models из конфигурации
                available_models = agent_config.get('available_models')
                if available_models:
                    # Убеждаемся, что основная модель тоже в списке
                    main_model = agent_config.get('model')
                    if main_model and main_model not in available_models:
                        available_models = [main_model] + available_models
                
                if available_models != existing.available_models:
                    existing.available_models = available_models
                    changed = True
                
                if changed:
                    if not dry_run:
                        session.add(existing)
                        session.commit()
                        session.refresh(existing)
                    print(f"✅ Обновлен: {name} (ID: {existing.id})")
                    updated_count += 1
                else:
                    print(f"⏭️  Без изменений: {name} (ID: {existing.id})")
            else:
                # Создаем нового агента
                if not dry_run:
                    # Подготавливаем available_models
                    available_models = agent_config.get('available_models')
                    if available_models:
                        # Убеждаемся, что основная модель тоже в списке
                        main_model = agent_config.get('model', 'deepseek/deepseek-chat')
                        if main_model and main_model not in available_models:
                            available_models = [main_model] + available_models
                    
                    new_agent = Agent(
                        name=name,
                        instructions=agent_config.get('instructions', ''),
                        model=agent_config.get('model', 'deepseek/deepseek-chat'),
                        category=agent_config.get('category', 'general'),
                        description=agent_config.get('description'),
                        icon_name=agent_config.get('icon_name', 'psychology'),
                        color_class=agent_config.get('color_class', 'bg-blue-500'),
                        is_active=agent_config.get('is_active', True),
                        available_models=available_models,
                    )
                    session.add(new_agent)
                    session.commit()
                    session.refresh(new_agent)
                    print(f"➕ Создан: {name} (ID: {new_agent.id})")
                else:
                    print(f"➕ [DRY RUN] Будет создан: {name}")
                created_count += 1
        
        if not dry_run:
            session.commit()
        
        print(f"\n📊 Итого:")
        print(f"   Обновлено: {updated_count}")
        print(f"   Создано: {created_count}")
        if remove_orphans:
            print(f"   Удалено: {removed_count}")
        if dry_run:
            print(f"\n⚠️  DRY RUN - изменения не применены")


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Синхронизация агентов из YAML конфигурации')
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Показать что будет изменено без применения изменений'
    )
    parser.add_argument(
        '--config',
        type=str,
        help='Путь к файлу конфигурации (по умолчанию: backend/config/agents.yaml)'
    )
    parser.add_argument(
        '--remove-orphans',
        action='store_true',
        help='Удалить агентов из БД, которых нет в конфигурации'
    )
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - изменения не будут применены\n")
    
    if args.remove_orphans and not args.dry_run:
        print("⚠️  ВНИМАНИЕ: Будут удалены агенты, отсутствующие в конфигурации\n")
    
    sync_agents_from_config(dry_run=args.dry_run, remove_orphans=args.remove_orphans)


if __name__ == "__main__":
    main()



