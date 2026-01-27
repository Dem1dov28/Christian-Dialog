import os
from dotenv import load_dotenv
from sqlmodel import Session, select
from core.database import get_session, create_db_and_tables
from models.message import Message
from models.conversation import Conversation
from models.multi_agent_conversation import MultiAgentConversation

# Load environment variables
load_dotenv()

# Create tables if they don't exist
create_db_and_tables()

print("Testing database connection and queries...")

try:
    with get_session() as session:
        # Test querying messages
        print("Querying messages...")
        messages = session.exec(select(Message)).all()
        print(f"Found {len(messages)} messages")
        
        # Test querying conversations
        print("Querying conversations...")
        conversations = session.exec(select(Conversation)).all()
        print(f"Found {len(conversations)} conversations")
        
        # Test querying multi-agent conversations
        print("Querying multi-agent conversations...")
        multi_conversations = session.exec(select(MultiAgentConversation)).all()
        print(f"Found {len(multi_conversations)} multi-agent conversations")
        
        print("Database queries successful!")
        
except Exception as e:
    print(f"Error querying database: {e}")
    import traceback
    traceback.print_exc()