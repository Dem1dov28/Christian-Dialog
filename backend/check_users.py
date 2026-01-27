from sqlmodel import Session, select
from core.database import get_session
from models.user import User

with get_session() as session:
    users = session.exec(select(User)).all()
    print(f'Found {len(users)} users')
    for u in users:
        print(f'ID: {u.id}, Username: {u.username}, Email: {u.email}')