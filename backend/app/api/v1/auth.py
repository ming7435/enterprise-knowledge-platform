from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_settings
from app.core.config import Settings
from app.core.security import create_access_token
from app.models.entities import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserPublic,
)
from app.services.auth_service import authenticate_user, register_user, user_to_public
from app.services.workspace_service import workspace_to_public

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    user, workspace = register_user(
        db,
        email=payload.email,
        username=payload.username,
        password=payload.password,
    )
    return {
        "user": user_to_public(user),
        "personal_workspace": workspace_to_public(workspace, "owner"),
    }


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    user = authenticate_user(db, email=payload.email, password=payload.password)
    return {
        "access_token": create_access_token(
            user.id,
            settings.jwt_secret_key,
            settings.jwt_access_token_expire_minutes,
        ),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return user_to_public(current_user)
