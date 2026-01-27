from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional


class UserChannelSubscriptionBase(SQLModel):
    user_id: int = Field(foreign_key="user.id")
    channel_id: int = Field(foreign_key="conversation.id")
    unread_count: int = Field(default=0)


class UserChannelSubscription(UserChannelSubscriptionBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    subscribed_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = Field(default=True)
    
    # Связи
    # Note: We don't create back_populates relationships here to avoid circular imports
    # The relationships are handled in the respective models


class UserChannelSubscriptionPublic(UserChannelSubscriptionBase):
    id: int
    subscribed_at: datetime
    is_active: bool


class UserChannelSubscriptionCreate(UserChannelSubscriptionBase):
    pass