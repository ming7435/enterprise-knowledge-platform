from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.deps import get_settings
from app.core.config import Settings
from app.models.entities import User
from app.schemas.workspaces import EnterpriseWorkspaceCreate, WorkspacePublic
from app.services.workspace_service import (
    create_workspace_with_owner,
    delete_workspace_with_contents,
    list_user_workspaces,
    require_workspace_member,
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
    return workspace_to_public(workspace, "owner")


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
    return workspace_to_public(workspace, "owner")


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


@router.get("/{workspace_id}", response_model=WorkspacePublic)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace, membership = require_workspace_member(
        db,
        user=current_user,
        workspace_id=workspace_id,
    )
    return workspace_to_public(workspace, membership.role)
