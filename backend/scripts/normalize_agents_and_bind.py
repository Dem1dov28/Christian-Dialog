import os
import sys
from typing import List
from sqlmodel import Session, select

# Ensure backend package is on sys.path when running this script directly
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.agent import Agent
from models.folder import Folder


def unique_append(existing_ids: List[int], new_ids: List[int]) -> List[int]:
    existing_set = set(existing_ids or [])
    for i in new_ids:
        if i not in existing_set:
            existing_set.add(i)
    return list(existing_set)


def normalize_categories(session: Session) -> List[int]:
    """Set category to 'chats' for known character agents and legacy categories; return affected agent IDs."""
    known_character_names = {
        "Владимир Зеленский", "Vladimir Zelensky",
        "Дональд Трамп", "Donald Trump",
        "Павел Дуров", "Pavel Durov", "Павел Дрова", "Pavel Drova",
        "Марк Аврелий", "Marcus Aurelius", "Марк Аврелиус",
        "Илон Маск", "Elon Musk",
    }
    agents = session.exec(select(Agent)).all()
    changed_ids: List[int] = []
    for a in agents:
        legacy = (a.category or "").lower() in {"characters", "character", "персонаж"}
        is_known = (a.name or "") in known_character_names
        if (legacy or is_known) and a.category != "chats":
            a.category = "chats"
            session.add(a)
            changed_ids.append(a.id)
            print(f"Updated category -> chats for agent id={a.id}, name={a.name}")
    if changed_ids:
        session.commit()
    return changed_ids


def bind_to_characters_folder(session: Session, agent_ids: List[int]) -> int:
    """Bind given agent IDs to every system folder named 'Персонажи'. Returns number of folders updated."""
    if not agent_ids:
        return 0
    folders = session.exec(
        select(Folder).where(
            Folder.folder_type == "system",
            Folder.name == "Персонажи",
        )
    ).all()
    updated = 0
    for f in folders:
        current = f.get_agent_ids()
        merged = unique_append(current, agent_ids)
        if set(current) != set(merged):
            f.set_agent_ids(merged)
            session.add(f)
            updated += 1
    if updated:
        session.commit()
    return updated


def main():
    create_db_and_tables()
    with Session(engine) as session:
        # Normalize categories for all agents
        changed_ids = normalize_categories(session)

        # If none changed, still gather all agent ids with 'Персонаж' to make sure folders contain all
        if not changed_ids:
            changed_ids = [a.id for a in session.exec(select(Agent).where(Agent.category == "Персонаж")).all()]

        updated_folders = bind_to_characters_folder(session, changed_ids)
        print(
            f"✅ Normalized agents: {len(changed_ids)}; Updated 'Персонажи' folders: {updated_folders}"
        )


if __name__ == "__main__":
    main()


