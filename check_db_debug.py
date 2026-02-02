from sqlmodel import Session, select, create_engine
import sys
import os

# Добавляем путь к backend
sys.path.append(os.getcwd())

from backend.models.agent import Agent
from backend.models.multi_agent_conversation import MultiAgentConversation

engine = create_engine("sqlite:///backend/database.db")

def check_db():
    with Session(engine) as session:
        # Проверяем агентов
        agents = session.exec(select(Agent)).all()
        print(f"--- AGENTS ({len(agents)}) ---")
        for a in agents:
            print(f"ID: {a.id}, Name: {a.name}, Model: {a.model}, Active: {a.is_active}")
        
        # Проверяем групповые чаты
        convs = session.exec(select(MultiAgentConversation)).all()
        print(f"\n--- MULTI-AGENT CONVERSATIONS ({len(convs)}) ---")
        for c in convs:
            print(f"ID: {c.id}, Title: {c.title}")

if __name__ == "__main__":
    check_db()
