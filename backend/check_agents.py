#!/usr/bin/env python3
"""
Script to check agents in the database
"""

import os
import sys
from dotenv import load_dotenv

# Add backend to path
CURRENT_DIR = os.path.dirname(__file__)
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Load environment variables
load_dotenv()

from core.database import engine
from sqlmodel import Session, select
from models.agent import Agent

def main():
    with Session(engine) as session:
        # Get all agents
        agents = session.exec(select(Agent)).all()
        print(f'Total agents: {len(agents)}')
        
        # Get user-created agents
        user_agents = [a for a in agents if a.user_id is not None]
        print(f'\nUser-created agents ({len(user_agents)}):')
        for agent in user_agents:
            print(f'{agent.id}: {agent.name} (user_id: {agent.user_id})')
            print(f'  Category: {agent.category}')
            print(f'  Model: {agent.model}')
            print('---')
        
        # Get global agents
        global_agents = [a for a in agents if a.user_id is None]
        print(f'\nGlobal agents ({len(global_agents)}):')
        for agent in global_agents:
            print(f'{agent.id}: {agent.name}')
            print(f'  Category: {agent.category}')
            print(f'  Model: {agent.model}')
            print('---')

if __name__ == '__main__':
    main()