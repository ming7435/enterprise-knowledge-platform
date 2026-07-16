from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import (
    AuditLog,
    ChatMessage,
    ChatSession,
    Document,
    DocumentChunk,
    KnowledgeBase,
    User,
    VectorIndex,
    Workspace,
    WorkspaceMember,
    WorkspaceSetting,
)
from app.services.storage_service import delete_document_file

WORKSPACE_ROLES = {"owner", "admin", "member", "viewer"}
WORKSPACE_WRITE_ROLES = {"owner", "admin", "member"}
WORKSPACE_MANAGE_ROLES = {"owner", "admin"}


def write_audit_log(
    db: Session,
    *,
    action: str,
    user_id: str | None = None,
    workspace_id: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            action=action,
            user_id=user_id,
            workspace_id=workspace_id,
            target_type=target_type,
            target_id=target_id,
            detail=detail or {},
        )
    )


def workspace_to_public(
    workspace: Workspace,
    role: str | None = None,
    document_count: int = 0,
    latest_document_updated_at: datetime | None = None,
) -> dict:
    updated_at = workspace.updated_at
    if (
        latest_document_updated_at is not None
        and latest_document_updated_at > updated_at
    ):
        updated_at = latest_document_updated_at
    return {
        "id": workspace.id,
        "name": workspace.name,
        "type": workspace.type,
        "description": workspace.description,
        "status": workspace.status,
        "role": role,
        "updated_at": updated_at,
        "document_count": document_count,
    }


def workspace_member_to_public(member: WorkspaceMember, user: User) -> dict:
    return {
        "id": member.id,
        "workspace_id": member.workspace_id,
        "user_id": user.id,
        "email": user.email,
        "username": user.username,
        "role": member.role,
        "department": member.department,
        "status": member.status,
        "joined_at": member.joined_at,
    }


def create_workspace_with_owner(
    db: Session,
    *,
    owner: User,
    name: str,
    workspace_type: str,
    description: str | None = None,
) -> Workspace:
    workspace = Workspace(
        name=name,
        type=workspace_type,
        owner_user_id=owner.id,
        description=description,
        status="active",
    )
    db.add(workspace)
    db.flush()
    db.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner.id,
            role="owner",
            status="active",
        )
    )
    db.add(KnowledgeBase(workspace_id=workspace.id, status="empty"))
    db.add(VectorIndex(workspace_id=workspace.id))
    write_audit_log(
        db,
        action="workspace.created",
        user_id=owner.id,
        workspace_id=workspace.id,
        target_type="workspace",
        target_id=workspace.id,
        detail={"type": workspace_type},
    )
    return workspace


def list_user_workspaces(db: Session, user: User) -> list[dict]:
    document_count = _active_document_count_subquery()
    latest_document_updated_at = _latest_document_updated_at_subquery()
    rows = db.execute(
        select(
            Workspace,
            WorkspaceMember.role,
            document_count.label("document_count"),
            latest_document_updated_at.label("latest_document_updated_at"),
        )
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
            Workspace.status == "active",
        )
        .order_by(Workspace.type.desc(), Workspace.created_at.asc())
    ).all()
    return [
        workspace_to_public(
            workspace,
            role,
            count,
            latest_document_updated_at,
        )
        for workspace, role, count, latest_document_updated_at in rows
    ]


def get_user_workspace_public(
    db: Session,
    *,
    user: User,
    workspace_id: str,
) -> dict:
    document_count = _active_document_count_subquery()
    latest_document_updated_at = _latest_document_updated_at_subquery()
    row = db.execute(
        select(
            Workspace,
            WorkspaceMember.role,
            document_count.label("document_count"),
            latest_document_updated_at.label("latest_document_updated_at"),
        )
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            Workspace.status == "active",
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该工作区",
        )
    workspace, role, count, latest_document_updated_at = row
    return workspace_to_public(
        workspace,
        role,
        count,
        latest_document_updated_at,
    )


def _active_document_count_subquery():
    return (
        select(func.count(Document.id))
        .where(
            Document.workspace_id == Workspace.id,
            Document.deleted_at.is_(None),
        )
        .correlate(Workspace)
        .scalar_subquery()
    )


def _latest_document_updated_at_subquery():
    return (
        select(func.max(Document.updated_at))
        .where(Document.workspace_id == Workspace.id)
        .correlate(Workspace)
        .scalar_subquery()
    )


def require_workspace_member(
    db: Session,
    *,
    user: User,
    workspace_id: str,
) -> tuple[Workspace, WorkspaceMember]:
    row = db.execute(
        select(Workspace, WorkspaceMember)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            Workspace.status == "active",
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该工作区",
        )
    return row


def require_workspace_role(
    db: Session,
    *,
    user: User,
    workspace_id: str,
    allowed_roles: set[str],
) -> tuple[Workspace, WorkspaceMember]:
    workspace, membership = require_workspace_member(
        db,
        user=user,
        workspace_id=workspace_id,
    )
    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前角色无权执行该操作",
        )
    return workspace, membership


def list_workspace_members(
    db: Session,
    *,
    user: User,
    workspace_id: str,
) -> list[dict]:
    workspace, _membership = require_workspace_role(
        db,
        user=user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    _require_enterprise_workspace(workspace)
    rows = db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == "active",
        )
        .order_by(WorkspaceMember.role.asc(), WorkspaceMember.joined_at.asc())
    ).all()
    return [workspace_member_to_public(member, member_user) for member, member_user in rows]


def add_workspace_member_by_email(
    db: Session,
    *,
    actor: User,
    workspace_id: str,
    email: str,
    role: str,
    department: str | None = None,
) -> dict:
    workspace, actor_membership = require_workspace_role(
        db,
        user=actor,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    _require_enterprise_workspace(workspace)
    normalized_role = _normalize_member_role(role)
    if normalized_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能通过成员邀请创建 owner 角色",
        )
    if actor_membership.role == "admin" and normalized_role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员不能添加其他管理员",
        )

    normalized_email = email.strip().lower()
    target_user = db.execute(
        select(User).where(User.email == normalized_email, User.status == "active")
    ).scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在，请先让对方注册账号",
        )

    existing = db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == target_user.id,
        )
    ).scalar_one_or_none()
    if existing is not None and existing.status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该用户已经是工作区成员",
        )
    if existing is None:
        membership = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=target_user.id,
            role=normalized_role,
            department=department,
            status="active",
        )
        db.add(membership)
    else:
        membership = existing
        membership.role = normalized_role
        membership.department = department
        membership.status = "active"

    write_audit_log(
        db,
        action="member.added",
        user_id=actor.id,
        workspace_id=workspace_id,
        target_type="workspace_member",
        target_id=target_user.id,
        detail={
            "email": target_user.email,
            "role": normalized_role,
            "department": department,
        },
    )
    db.flush()
    return workspace_member_to_public(membership, target_user)


def update_workspace_member(
    db: Session,
    *,
    actor: User,
    workspace_id: str,
    member_id: str,
    role: str,
    department: str | None = None,
) -> dict:
    workspace, actor_membership = require_workspace_role(
        db,
        user=actor,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    _require_enterprise_workspace(workspace)
    membership, target_user = _get_active_workspace_member(
        db,
        workspace_id=workspace_id,
        member_id=member_id,
    )
    if membership.user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能修改自己的工作区角色",
        )
    _ensure_member_is_manageable(
        workspace=workspace,
        actor_membership=actor_membership,
        target_membership=membership,
    )
    normalized_role = _normalize_member_role(role)
    if normalized_role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能把成员角色修改为 owner",
        )
    if actor_membership.role == "admin" and normalized_role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员不能授予管理员角色",
        )

    old_role = membership.role
    membership.role = normalized_role
    membership.department = department
    write_audit_log(
        db,
        action="member.role_updated",
        user_id=actor.id,
        workspace_id=workspace_id,
        target_type="workspace_member",
        target_id=membership.id,
        detail={
            "email": target_user.email,
            "old_role": old_role,
            "new_role": normalized_role,
            "department": department,
        },
    )
    db.flush()
    return workspace_member_to_public(membership, target_user)


def remove_workspace_member(
    db: Session,
    *,
    actor: User,
    workspace_id: str,
    member_id: str,
) -> None:
    workspace, actor_membership = require_workspace_role(
        db,
        user=actor,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    _require_enterprise_workspace(workspace)
    membership, target_user = _get_active_workspace_member(
        db,
        workspace_id=workspace_id,
        member_id=member_id,
    )
    if membership.user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能移除自己",
        )
    _ensure_member_is_manageable(
        workspace=workspace,
        actor_membership=actor_membership,
        target_membership=membership,
    )
    membership.status = "removed"
    write_audit_log(
        db,
        action="member.removed",
        user_id=actor.id,
        workspace_id=workspace_id,
        target_type="workspace_member",
        target_id=membership.id,
        detail={"email": target_user.email, "role": membership.role},
    )
    db.flush()


def delete_workspace_with_contents(
    db: Session,
    *,
    settings: Settings,
    user: User,
    workspace_id: str,
) -> Workspace:
    row = db.execute(
        select(Workspace, WorkspaceMember)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            Workspace.id == workspace_id,
            Workspace.status == "active",
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权删除该工作区",
        )

    workspace, membership = row
    if membership.role != "owner" or workspace.owner_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有工作区所有者可以删除工作区",
        )

    documents = db.execute(
        select(Document).where(Document.workspace_id == workspace_id)
    ).scalars().all()
    for document in documents:
        delete_document_file(settings, document.file_path)

    db.execute(delete(ChatMessage).where(ChatMessage.workspace_id == workspace_id))
    db.execute(delete(ChatSession).where(ChatSession.workspace_id == workspace_id))
    db.execute(delete(DocumentChunk).where(DocumentChunk.workspace_id == workspace_id))
    db.execute(delete(Document).where(Document.workspace_id == workspace_id))
    db.execute(
        delete(WorkspaceSetting).where(WorkspaceSetting.workspace_id == workspace_id)
    )
    db.execute(delete(KnowledgeBase).where(KnowledgeBase.workspace_id == workspace_id))
    db.execute(delete(VectorIndex).where(VectorIndex.workspace_id == workspace_id))
    db.execute(delete(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id))
    db.execute(delete(AuditLog).where(AuditLog.workspace_id == workspace_id))

    write_audit_log(
        db,
        action="workspace.deleted",
        user_id=user.id,
        target_type="workspace",
        target_id=workspace.id,
        detail={
            "name": workspace.name,
            "type": workspace.type,
        },
    )
    db.delete(workspace)
    db.flush()
    return workspace


def _require_enterprise_workspace(workspace: Workspace) -> None:
    if workspace.type != "enterprise":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="成员协作仅支持企业工作区",
        )


def _normalize_member_role(role: str) -> str:
    normalized_role = role.strip().lower()
    if normalized_role not in WORKSPACE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="成员角色必须是 owner、admin、member 或 viewer",
        )
    return normalized_role


def _get_active_workspace_member(
    db: Session,
    *,
    workspace_id: str,
    member_id: str,
) -> tuple[WorkspaceMember, User]:
    row = db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(
            WorkspaceMember.id == member_id,
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.status == "active",
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="成员不存在",
        )
    return row


def _ensure_member_is_manageable(
    *,
    workspace: Workspace,
    actor_membership: WorkspaceMember,
    target_membership: WorkspaceMember,
) -> None:
    if target_membership.role == "owner" or target_membership.user_id == workspace.owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能修改或移除工作区所有者",
        )
    if actor_membership.role == "admin" and target_membership.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员不能管理其他管理员",
        )
