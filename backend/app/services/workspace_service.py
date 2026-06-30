from fastapi import HTTPException, status
from sqlalchemy import delete, select
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


def workspace_to_public(workspace: Workspace, role: str | None = None) -> dict:
    return {
        "id": workspace.id,
        "name": workspace.name,
        "type": workspace.type,
        "description": workspace.description,
        "status": workspace.status,
        "role": role,
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
    rows = db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.status == "active",
            Workspace.status == "active",
        )
        .order_by(Workspace.type.desc(), Workspace.created_at.asc())
    ).all()
    return [workspace_to_public(workspace, role) for workspace, role in rows]


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
