#!/usr/bin/env python3
"""
Migration script to add token_secret column to user table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import create_engine, Session, text
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration():
    # Get database URL from environment
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    # Create engine
    engine = create_engine(DATABASE_URL, echo=True)
    
    # Add token_secret column
    with Session(engine) as session:
        try:
            # Check if column exists
            result = session.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'token_secret'
            """))
            
            if result.fetchone():
                print("Column 'token_secret' already exists")
                return
            
            # Add the column
            session.execute(text("""
                ALTER TABLE "user" 
                ADD COLUMN token_secret VARCHAR
            """))
            
            # Set default value for existing users
            session.execute(text("""
                UPDATE "user" 
                SET token_secret = '' 
                WHERE token_secret IS NULL
            """))
            
            session.commit()
            print("Successfully added token_secret column to user table")
            
        except Exception as e:
            session.rollback()
            print(f"Error during migration: {e}")
            raise

if __name__ == "__main__":
    run_migration()
