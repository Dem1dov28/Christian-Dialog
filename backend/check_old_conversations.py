#!/usr/bin/env python3
"""
Script to check conversations using old gpt-3.5-turbo model
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
        conversations = session.exec(select(Conversation)).all()
        print(f'Total conversations: {len(conversations)}')
        
        # Find conversations with gpt-3.5-turbo model
        old_model_convs = []
        for conv in conversations:
            if conv.selected_model and 'gpt-3.5-turbo' in conv.selected_model:
                old_model_convs.append(conv)
        
        print(f'\nConversations with gpt-3.5-turbo model: {len(old_model_convs)}')
        for conv in old_model_convs:
            print(f'{conv.id}: {conv.title} - model: {conv.selected_model}')

if __name__ == '__main__':
    main()