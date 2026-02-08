from models.user import User, UserResponse


def create_user_response(user: User) -> UserResponse:
    """Создать UserResponse из User"""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        is_admin=user.is_admin,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login=user.last_login,
        email_verified=user.email_verified,
        subscription_tier=user.subscription_tier,
        messages_used=user.messages_used,
        messages_limit=user.messages_limit,
        api_access=user.api_access,
        api_key=user.api_key,
        expires_at=user.expires_at,
        messages_cycle_started_at=getattr(user, "messages_cycle_started_at", None),

        pinned_chats=user.get_pinned_chat_ids() if hasattr(user, "get_pinned_chat_ids") else [],
        auth_provider=getattr(user, "auth_provider", "local"),
    )
