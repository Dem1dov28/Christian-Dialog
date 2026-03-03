from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime


class VerificationCodeBase(SQLModel):
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    code: str = Field(..., min_length=6, max_length=6)
    expires_at: datetime
    is_used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class VerificationCodeCreate(SQLModel):
    email: str
    code: str
    expires_at: datetime


class VerificationCode(VerificationCodeBase, table=True):
    __tablename__ = 'verification_codes'
    
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(..., index=True)
    code: str
    expires_at: datetime
    is_used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used_at: Optional[datetime] = Field(default=None)


class VerifyCodeRequest(SQLModel):
    email: str
    code: str


class VerifyCodeResponse(SQLModel):
    success: bool
    message: str
    token: Optional[str] = None


class SendResetCodeRequest(SQLModel):
    email: str


class ResetPasswordRequest(SQLModel):
    email: str
    token: str
    new_password: str
