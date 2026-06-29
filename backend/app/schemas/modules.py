from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(default="unknown", max_length=50)


class DocumentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    filename: str
    file_type: str
    file_path: str | None
    parse_status: str
    index_status: str
    chunk_count: int
    permission_scope: str
    created_at: datetime


class KnowledgeBaseStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: str
    status: str
    document_count: int
    chunk_count: int


class ChatSessionCreate(BaseModel):
    title: str = Field(default="新会话", max_length=160)
    mode: str = Field(default="normal", max_length=40)


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    title: str
    mode: str


class WorkspaceSettingPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    setting_key: str
    setting_value: dict
    setting_type: str
    encrypted: str


class AuditLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str | None
    user_id: str | None
    action: str
    target_type: str | None
    target_id: str | None
    detail: dict
