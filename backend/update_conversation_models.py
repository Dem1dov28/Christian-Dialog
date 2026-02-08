#!/usr/bin/env python3
"""
Script to update all conversations from gpt-3.5-turbo to tngtech/deepseek-r1t2-chimera:free
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
from models.conversation import Conversation

def main():
    with Session(engine) as session:
        # Get all conversations with gpt-3.5-turbo model
        conversations = session.exec(
            select(Conversation).where(Conversation.selected_model.contains('gpt-3.5-turbo'))
        ).all()
        
        print(f'Found {len(conversations)} conversations with gpt-3.5-turbo model')
        
        # Update each conversation
        for conv in conversations:
            print(f'Updating conversation {conv.id}: {conv.title} from {conv.selected_model} to tngtech/deepseek-r1t2-chimera:free')
            conv.selected_model = 'tngtech/deepseek-r1t2-chimera:free'
            session.add(conv)
        
        # Commit all changes
        session.commit()
        print(f'Successfully updated {len(conversations)} conversations')

if __name__ == '__main__':
    main()