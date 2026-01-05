from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session
from core.database import get_session
from core.auth import verify_token, get_user_by_id, TokenData
from models.user import User

# Схема для Bearer токена
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session)
) -> User:
    """Получение текущего пользователя из токена"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = verify_token(credentials.credentials, credentials_exception)
    user = get_user_by_id(db, token_data.user_id)
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь деактивирован"
        )
    
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Получение активного пользователя
    
    Примечание: Проверка is_active уже выполняется в get_current_user,
    поэтому эта функция просто возвращает пользователя для совместимости.
    """
    # Проверка is_active уже выполнена в get_current_user, просто возвращаем
    return current_user


def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Получение администратора"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав доступа"
        )
    return current_user


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session)
) -> User | None:
    """Получение текущего пользователя (опционально)"""
    try:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось проверить учетные данные",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
        token_data = verify_token(credentials.credentials, credentials_exception)
        user = get_user_by_id(db, token_data.user_id)
        
        if user is None or not user.is_active:
            return None
        
        return user
    except HTTPException:
        return None
