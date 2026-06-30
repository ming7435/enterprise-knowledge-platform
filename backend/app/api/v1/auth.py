from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_settings
from app.core.config import Settings
from app.core.security import create_access_token
from app.models.entities import User
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    EmailCodeLoginRequest,
    ResetPasswordRequest,
    SendEmailCodeRequest,
    SendEmailCodeResponse,
    TokenResponse,
    UserPublic,
)
from app.services.auth_service import (
    authenticate_user,
    authenticate_user_by_email_code,
    register_user,
    reset_user_password,
    user_to_public,
)
from app.services.email_verification_service import create_email_verification_service
from app.services.workspace_service import workspace_to_public

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    verification_service = create_email_verification_service(settings)
    user, workspace = register_user(
        db,
        email=payload.email,
        username=payload.username,
        password=payload.password,
        verification_code=payload.verification_code,
        verification_service=verification_service,
    )
    return {
        "user": user_to_public(user),
        "personal_workspace": workspace_to_public(workspace, "owner"),
    }


@router.post(
    "/email-code/send",
    response_model=SendEmailCodeResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def send_email_code(
    payload: SendEmailCodeRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    normalized_email = payload.email.lower()
    user = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if payload.purpose == "register" and user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="邮箱已注册，请直接登录",
        )
    if payload.purpose == "login" and user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="邮箱未注册，请先注册",
        )
    if payload.purpose == "reset_password" and user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="邮箱未注册，请先注册",
        )

    verification_service = create_email_verification_service(settings)
    try:
        verification_service.send_code(
            db,
            email=normalized_email,
            purpose=payload.purpose,
        )
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="邮件发送失败，请检查 SMTP 配置",
        ) from exc

    return {"message": "验证码已发送，请查看邮箱"}


@router.post("/password/reset", response_model=SendEmailCodeResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    verification_service = create_email_verification_service(settings)
    reset_user_password(
        db,
        email=payload.email,
        verification_code=payload.verification_code,
        new_password=payload.new_password,
        verification_service=verification_service,
    )
    db.commit()
    return {"message": "密码已重置，请使用新密码登录"}


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


@router.post("/email-code/login", response_model=TokenResponse)
def login_with_email_code(
    payload: EmailCodeLoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    verification_service = create_email_verification_service(settings)
    user = authenticate_user_by_email_code(
        db,
        email=payload.email,
        verification_code=payload.verification_code,
        verification_service=verification_service,
    )
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
