#!/usr/bin/env python3
import os
import sys
from sqlmodel import Session, select

CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.multi_agent_conversation import MultiAgentConversation


def main(title: str):
    create_db_and_tables()
    with Session(engine) as session:
        convs = session.exec(
            select(MultiAgentConversation).where(MultiAgentConversation.title == title)
        ).all()
        if not convs:
            print(f"No multi-agent conversations found with title='{title}'")
            return
        for c in convs:
            print(f"ID={c.id} title='{c.title}' user_id={c.user_id}")


if __name__ == "__main__":
    title = sys.argv[1] if len(sys.argv) > 1 else "123123123"
    main(title)
