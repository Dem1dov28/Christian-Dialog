from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlmodel import Session, select
from datetime import datetime
from pydantic import BaseModel
import logging

from models.user import User
from core.dependencies import get_current_active_user, get_session

logger = logging.getLogger(__name__)

class ReportCreate(BaseModel):
    message_id: Optional[int] = None
    text: str
