from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import utc_now
from app.core.security import hash_password, verify_password
from app.models.entities import User
from app.services.email_verification_service import EmailVerificationService
from app.services.workspace_service import create_workspace_with_owner, write_audit_log


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
    existing = db.execute(
        select(User).where(User.email == normalized_email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="邮箱已注册",
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

    user = User(
        email=normalized_email,
        username=username.strip(),
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
