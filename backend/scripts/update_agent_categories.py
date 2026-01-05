#!/usr/bin/env python3
"""
Скрипт для обновления категорий агентов

Устанавливает:
- Всем персонажам категорию "персонаж"
- Дополнительные категории для конкретных агентов:
  - Политик: Зеленский, Трамп, Путин
  - Герой фильма: Губка Боб, Пол Атрейдес
  - Миллиардер: Маск, Дуров, Цукерберг
  - Философ: Марк Аврелий, Ницше, Платон
"""

import os
import sys
from sqlmodel import Session, select

# Добавляем родительскую директорию в путь Python
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

from core.database import engine, create_db_and_tables
from models.agent import Agent


# Определение категорий для конкретных агентов
AGENT_CATEGORIES = {
    # Политики
    "Владимир Зеленский": ["персонаж", "политик"],
    "Vladimir Zelensky": ["персонаж", "политик"],
    "Дональд Трамп": ["персонаж", "политик"],
    "Donald Trump": ["персонаж", "политик"],
    "Владимир Путин": ["персонаж", "политик"],
    
    # Герои фильмов (удалены: Гарри Поттер, Дарт Вэйдер)

    
    # Миллиардеры
    "Илон Маск": ["персонаж", "миллиардер"],
    "Elon Musk": ["персонаж", "миллиардер"],
    "Павел Дуров": ["персонаж", "миллиардер"],
    "Pavel Durov": ["персонаж", "миллиардер"],
    "Павел Дрова": ["персонаж", "миллиардер"],
    "Pavel Drova": ["персонаж", "миллиардер"],
    
    # Философы
    "Марк Аврелий": ["персонаж", "философ"],
    "Marcus Aurelius": ["персонаж", "философ"],
    "Марк Аврелиус": ["персонаж", "философ"],
    "Фридрих Ницше": ["персонаж", "философ"],
    "Friedrich Nietzsche": ["персонаж", "философ"],
    "Платон": ["персонаж", "философ"],
    "Plato": ["персонаж", "философ"],
}

# Агенты, которые НЕ являются персонажами (инструменты, модели и т.д.)
NON_CHARACTER_AGENTS = {
    "Учитель английского": "tools",
}


def get_category_for_agent(agent_name: str) -> str:
    """Получить категорию для агента
    
    Args:
        agent_name: Имя агента
        
    Returns:
        Строка с категориями, разделенными запятыми
    """
    # Проверяем, не является ли агент инструментом или моделью
    if agent_name in NON_CHARACTER_AGENTS:
        return NON_CHARACTER_AGENTS[agent_name]
    
    # Проверяем, есть ли специальная категория для этого агента
    if agent_name in AGENT_CATEGORIES:
        return ", ".join(AGENT_CATEGORIES[agent_name])
    
    # По умолчанию все остальные агенты - персонажи
    return "персонаж"


def update_agent_categories():
    """Обновить категории для всех агентов"""
    create_db_and_tables()
    
    with Session(engine) as session:
        # Получаем всех агентов
        agents = session.exec(select(Agent)).all()
        print(f"Найдено {len(agents)} агентов для обновления:\n")
        
        updated_count = 0
        
        for agent in agents:
            current_category = agent.category or "(пусто)"
            new_category = get_category_for_agent(agent.name)
            
            if current_category != new_category:
                agent.category = new_category
                session.add(agent)
                updated_count += 1
                print(f"✅ {agent.name} (ID: {agent.id})")
                print(f"   {current_category} → {new_category}")
            else:
                print(f"⏭️  {agent.name} (ID: {agent.id})")
                print(f"   Категория уже правильная: {current_category}")
        
        if updated_count > 0:
            session.commit()
            print(f"\n🎉 Обновлено {updated_count} агентов!")
        else:
            print(f"\n✨ Все категории уже корректны!")
        
        # Показываем финальное состояние
        print(f"\n📊 Финальное состояние категорий:")
        agents = session.exec(select(Agent)).all()
        categories = {}
        for agent in agents:
            category = agent.category or "(пусто)"
            if category not in categories:
                categories[category] = []
            categories[category].append(agent.name)
        
        for category, agent_names in sorted(categories.items()):
            print(f"\n  {category}: {len(agent_names)} агентов")
            for name in sorted(agent_names):
                print(f"    - {name}")


if __name__ == "__main__":
    update_agent_categories()


