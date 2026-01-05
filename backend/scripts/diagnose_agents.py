import os
import sys
from collections import Counter
from sqlmodel import Session, select

# Ensure backend package is on sys.path when running this script directly
CURRENT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from core.database import engine, create_db_and_tables
from models.agent import Agent
from models.folder import Folder


def main():
    create_db_and_tables()
    db_file = os.path.abspath(os.path.join(PROJECT_ROOT, "database.db"))
    print(f"DB file expected at: {db_file}")
    with Session(engine) as session:
        agents = session.exec(select(Agent)).all()
        print(f"Agents total: {len(agents)}")
        for a in agents:
            print(f"- id={a.id} | name={a.name} | category={a.category}")

        # Category distribution
        categories = Counter((a.category or "").strip() for a in agents)
        print("Category counts:")
        for k, v in categories.items():
            print(f"  '{k or '(empty)'}': {v}")

        # Duplicates by name
        name_counts = Counter((a.name or "").strip() for a in agents)
        dups = [n for n, c in name_counts.items() if c > 1]
        if dups:
            print("Duplicate names detected:")
            for n in dups:
                ids = [a.id for a in agents if (a.name or "").strip() == n]
                print(f"  {n}: ids={ids}")
        else:
            print("No duplicate names.")

        # System folders 'Персонажи'
        folders = session.exec(select(Folder).where(Folder.folder_type == "system", Folder.name == "Персонажи")).all()
        print(f"System folders 'Персонажи': {len(folders)}")
        for f in folders:
            print(f"- folder_id={f.id} user_id={f.user_id} agent_ids={f.get_agent_ids()}")


if __name__ == "__main__":
    main()



