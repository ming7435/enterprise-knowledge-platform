from collections.abc import Generator

from fastapi import Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.models.entities import User


def get_db(request: Request) -> Generator[Session, None, None]:
    session_factory = request.app.state.SessionLocal
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


def get_settings(request: Request):
    return request.app.state.settings


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少登录凭证",
        )
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token, request.app.state.settings.jwt_secret_key)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证无效",
        ) from None

    db = request.app.state.SessionLocal()
    try:
        user = db.get(User, payload.get("sub"))
        if user is None or user.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="登录用户不存在",
            )
        return user
    finally:
        db.close()
