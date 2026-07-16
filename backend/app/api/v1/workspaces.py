from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.deps import get_settings
from app.core.config import Settings
from app.models.entities import User
from app.schemas.workspaces import (
    EnterpriseWorkspaceCreate,
    WorkspaceMemberCreate,
    WorkspaceMemberPublic,
    WorkspaceMemberUpdate,
    WorkspacePublic,
)
from app.services.workspace_service import (
    add_workspace_member_by_email,
    create_workspace_with_owner,
    delete_workspace_with_contents,
    get_user_workspace_public,
    list_workspace_members,
    list_user_workspaces,
    remove_workspace_member,
    update_workspace_member,
    workspace_to_public,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspacePublic])
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_user_workspaces(db, current_user)


@router.post(
    "/personal",
    response_model=WorkspacePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_personal_workspace(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = create_workspace_with_owner(
        db,
        owner=current_user,
        name=f"{current_user.username} 的个人工作区",
        workspace_type="personal",
        description="个人文档、知识库、问答和工具记录。",
    )
    db.commit()
    db.refresh(workspace)
    return workspace_to_public(workspace, "owner", document_count=0)


@router.post(
    "/enterprise",
    response_model=WorkspacePublic,
    status_code=status.HTTP_201_CREATED,
)
def create_enterprise_workspace(
    payload: EnterpriseWorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace = create_workspace_with_owner(
        db,
        owner=current_user,
        name=payload.name,
        workspace_type="enterprise",
        description=payload.description,
    )
    db.commit()
    db.refresh(workspace)
    return workspace_to_public(workspace, "owner", document_count=0)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    delete_workspace_with_contents(
        db,
        settings=settings,
        user=current_user,
        workspace_id=workspace_id,
    )
    db.commit()


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberPublic])
def get_workspace_members(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_workspace_members(
        db,
        user=current_user,
        workspace_id=workspace_id,
    )


@router.post(
    "/{workspace_id}/members",
    response_model=WorkspaceMemberPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_workspace_member(
    workspace_id: str,
    payload: WorkspaceMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = add_workspace_member_by_email(
        db,
        actor=current_user,
        workspace_id=workspace_id,
        email=payload.email,
        role=payload.role,
        department=payload.department,
    )
    db.commit()
    return member


@router.patch(
    "/{workspace_id}/members/{member_id}",
    response_model=WorkspaceMemberPublic,
)
def update_member(
    workspace_id: str,
    member_id: str,
    payload: WorkspaceMemberUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = update_workspace_member(
        db,
        actor=current_user,
        workspace_id=workspace_id,
        member_id=member_id,
        role=payload.role,
        department=payload.department,
    )
    db.commit()
    return member


@router.delete(
    "/{workspace_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_member(
    workspace_id: str,
    member_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    remove_workspace_member(
        db,
        actor=current_user,
        workspace_id=workspace_id,
        member_id=member_id,
    )
    db.commit()


@router.get("/{workspace_id}", response_model=WorkspacePublic)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_workspace_public(
        db,
        user=current_user,
        workspace_id=workspace_id,
    )
