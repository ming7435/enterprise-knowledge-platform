import re

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import utc_now
from app.core.security import hash_password, validate_password_strength, verify_password
from app.models.entities import User
from app.services.email_verification_service import EmailVerificationService
from app.services.workspace_service import create_workspace_with_owner, write_audit_log

USERNAME_PATTERN = re.compile(r"^[\u4e00-\u9fffA-Za-z0-9_-]{2,20}$")


def user_to_public(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "status": user.status,
    }


def register_user(
    db: Session,
    *,
    email: str,
    username: str,
    password: str,
    verification_code: str | None = None,
    verification_service: EmailVerificationService | None = None,
) -> tuple[User, object]:
    normalized_email = email.lower()
    clean_username = _normalize_username(username)
    existing = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="邮箱已注册",
        )
    existing_username = db.execute(
        select(User).where(func.lower(User.username) == clean_username.lower())
    ).scalar_one_or_none()
    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名已存在，请换一个用户名。",
        )

    if verification_service is not None:
        if not verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请输入邮箱验证码",
            )
        try:
            verification_service.consume_code(
                db,
                email=normalized_email,
                code=verification_code,
                purpose="register",
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    try:
        validate_password_strength(password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    user = User(
        email=normalized_email,
        username=clean_username,
        password_hash=hash_password(password),
        status="active",
    )
    db.add(user)
    db.flush()
    workspace = create_workspace_with_owner(
        db,
        owner=user,
        name=f"{user.username} 的个人工作区",
        workspace_type="personal",
        description="系统自动创建的个人知识空间",
    )
    write_audit_log(
        db,
        action="auth.registered",
        user_id=user.id,
        workspace_id=workspace.id,
        target_type="user",
        target_id=user.id,
        detail={"email": normalized_email},
    )
    db.commit()
    db.refresh(user)
    db.refresh(workspace)
    return user, workspace


def _normalize_username(username: str) -> str:
    clean_username = username.strip()
    if not USERNAME_PATTERN.fullmatch(clean_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名需为 2-20 个中文、英文、数字、下划线或中划线字符。",
        )
    return clean_username


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = db.execute(
        select(User).where(User.email == email.lower(), User.status == "active")
    ).scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
        )
    user.last_login_at = utc_now()
    write_audit_log(
        db,
        action="auth.login",
        user_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.commit()
    return user


def authenticate_user_by_email_code(
    db: Session,
    *,
    email: str,
    verification_code: str,
    verification_service: EmailVerificationService,
) -> User:
    normalized_email = email.lower()
    user = db.execute(
        select(User).where(User.email == normalized_email, User.status == "active")
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="邮箱未注册，请先注册",
        )
    try:
        verification_service.consume_code(
            db,
            email=normalized_email,
            code=verification_code,
            purpose="login",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    user.last_login_at = utc_now()
    write_audit_log(
        db,
        action="auth.email_code_login",
        user_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.commit()
    return user


def reset_user_password(
    db: Session,
    *,
    email: str,
    verification_code: str,
    new_password: str,
    verification_service: EmailVerificationService,
) -> User:
    normalized_email = email.lower()
    user = db.execute(
        select(User).where(User.email == normalized_email, User.status == "active")
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="邮箱未注册，请先注册",
        )
    try:
        verification_service.consume_code(
            db,
            email=normalized_email,
            code=verification_code,
            purpose="reset_password",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    try:
        validate_password_strength(new_password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    user.password_hash = hash_password(new_password)
    write_audit_log(
        db,
        action="auth.password_reset",
        user_id=user.id,
        target_type="user",
        target_id=user.id,
    )
    db.flush()
    return user
