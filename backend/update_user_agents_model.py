#!/usr/bin/env python3
"""
Script to update all user-created agents from google/gemini-2.0-flash-001 to tngtech/deepseek-r1t2-chimera:free
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
        # Get all user-created agents with google/gemini-2.0-flash-001 model
        user_agents = session.exec(
            select(Agent).where(
                Agent.user_id != None,
                Agent.model == 'google/gemini-2.0-flash-001'
            )
        ).all()
        
        print(f'Found {len(user_agents)} user-created agents with google/gemini-2.0-flash-001 model')
        
        # Update each agent
        for agent in user_agents:
            print(f'Updating user agent {agent.id}: {agent.name} from {agent.model} to tngtech/deepseek-r1t2-chimera:free')
            agent.model = 'tngtech/deepseek-r1t2-chimera:free'
            session.add(agent)
        
        # Commit all changes
        session.commit()
        print(f'Successfully updated {len(user_agents)} user agents')

if __name__ == '__main__':
    main()