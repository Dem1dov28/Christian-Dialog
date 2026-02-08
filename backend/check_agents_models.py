#!/usr/bin/env python3
"""
Script to check all agents and their models
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
        agents = session.exec(select(Agent)).all()
        print(f'Total agents: {len(agents)}')
        
        # Group agents by model
        model_groups = {}
        for agent in agents:
            model = agent.model or "None"
            if model not in model_groups:
                model_groups[model] = []
            model_groups[model].append(agent)
        
        print('\nAgents grouped by model:')
        print('=' * 50)
        
        for model, agent_list in model_groups.items():
            print(f'\nModel: {model} ({len(agent_list)} agents)')
            print('-' * 30)
            for agent in agent_list:
                user_status = "User-created" if agent.user_id else "Global"
                print(f'  {agent.id}: {agent.name} ({user_status})')
                if agent.category:
                    print(f'    Category: {agent.category}')
        
        # Also show user-created vs global agents
        print('\n' + '=' * 50)
        user_agents = [a for a in agents if a.user_id is not None]
        global_agents = [a for a in agents if a.user_id is None]
        
        print(f'\nUser-created agents: {len(user_agents)}')
        for agent in user_agents:
            print(f'  {agent.id}: {agent.name} (user_id: {agent.user_id}) - model: {agent.model}')
        
        print(f'\nGlobal agents: {len(global_agents)}')
        for agent in global_agents:
            print(f'  {agent.id}: {agent.name} - model: {agent.model}')

if __name__ == '__main__':
    main()