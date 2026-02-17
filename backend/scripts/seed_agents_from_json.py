import json
import logging
from pathlib import Path

from sqlmodel import Session, select

from core.database import engine
from models.agent import Agent


logger = logging.getLogger(__name__)


def seed_agents() -> int:
    """
    Импортирует персонажей из extracted_agents.json в таблицу agent.
    Скрипт идемпотентный: существующие агенты с тем же name не дублируются.
    """
    # Внутри Docker backend-код лежит в /app, а этот скрипт — в /app/scripts.
    # Нам нужен корень backend-проекта (=/app), поэтому берём родительскую директорию.
    project_root = Path(__file__).resolve().parent.parent  # /app
    json_path = project_root / "extracted_agents.json"

    if not json_path.exists():
        raise FileNotFoundError(f"Файл с агентами не найден: {json_path}")

    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    agents_data = data.get("agents", {})
    if not isinstance(agents_data, dict):
        raise ValueError("Некорректный формат extracted_agents.json: поле 'agents' должно быть словарём")

    created_count = 0

    with Session(engine) as session:
        for key, info in agents_data.items():
            name = (info.get("name") or str(key)).strip()
            description = (info.get("description") or "").strip()

            if not name:
                continue

            # Проверяем, есть ли уже такой агент по имени
            existing = session.exec(select(Agent).where(Agent.name == name)).first()
            if existing:
                continue

            agent = Agent(
                name=name,
                instructions=f"Ты — персонаж {name}. Отвечай в его стиле и характере, опираясь на исторические факты и биографию.",
                description=description,
                model="tngtech/deepseek-r1t2-chimera:free",
                category="character",
                is_active=True,
                temperature=0.7,
            )
            session.add(agent)
            created_count += 1

        session.commit()

    logger.info("Импортировано персонажей: %s", created_count)
    print(f"Импортировано персонажей: {created_count}")
    return created_count


if __name__ == "__main__":
    seed_agents()

