from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspacePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    description: str | None = None
    status: str
    role: str | None = None


class EnterpriseWorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class WorkspaceMemberCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    role: str = Field(default="member", max_length=20)
    department: str | None = Field(default=None, max_length=120)


class WorkspaceMemberUpdate(BaseModel):
    role: str = Field(max_length=20)
    department: str | None = Field(default=None, max_length=120)


class WorkspaceMemberPublic(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    email: str
    username: str
    role: str
    department: str | None = None
    status: str
    joined_at: datetime
