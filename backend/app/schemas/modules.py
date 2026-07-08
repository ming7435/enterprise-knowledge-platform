from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(default="unknown", max_length=50)


class DocumentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    user_id: str
    filename: str
    file_type: str
    file_path: str | None
    parse_status: str
    index_status: str
    chunk_count: int
    permission_scope: str
    created_at: datetime


class DocumentContentPublic(BaseModel):
    document: DocumentPublic
    library_name: str
    content: str
    chunk_count: int


class KnowledgeBaseStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: str
    status: str
    document_count: int
    chunk_count: int


class DocumentChunkPublic(BaseModel):
    id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float = 0


class KnowledgeSearchResult(BaseModel):
    id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


class ChatAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    top_k: int | None = Field(default=None, ge=1, le=20)
    document_ids: list[str] | None = None
    use_knowledge_base: bool = False


class ChatSessionCreate(BaseModel):
    title: str = Field(default="新会话", max_length=160)
    mode: str = Field(default="normal", max_length=40)


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    title: str
    mode: str


class ChatSourcePublic(BaseModel):
    id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


class ChatAskResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    session: ChatSessionPublic
    answer: str
    sources: list[ChatSourcePublic]
    model_name: str
    use_knowledge_base: bool


class WorkspaceSettingPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    setting_key: str
    setting_value: dict
    setting_type: str
    encrypted: str


class WorkspaceSettingUpdate(BaseModel):
    setting_value: dict
    setting_type: str = "json"


class WorkspaceModelConnectionTestRequest(BaseModel):
    setting_key: str = Field(max_length=120)
    setting_value: dict


class WorkspaceModelConnectionTestResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    ok: bool
    provider: str
    model_name: str
    message: str
    response_preview: str | None = None


class AuditLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str | None
    user_id: str | None
    action: str
    target_type: str | None
    target_id: str | None
    detail: dict
    created_at: datetime


class AdvancedOverviewPublic(BaseModel):
    workspace_id: str
    document_count: int
    chunk_count: int
    member_count: int
    audit_log_count: int
    vector_status: str
    graph_status: str
    rerank_status: str
    latest_activity_at: datetime | None = None


class KnowledgeGraphNodePublic(BaseModel):
    id: str
    label: str
    type: str
    weight: int = 1
    properties: dict = Field(default_factory=dict)


class KnowledgeGraphEdgePublic(BaseModel):
    id: str
    source: str
    target: str
    label: str
    weight: int = 1
    properties: dict = Field(default_factory=dict)


class KnowledgeGraphStatsPublic(BaseModel):
    node_count: int = 0
    edge_count: int = 0
    workspace_id: str | None = None


class KnowledgeGraphPublic(BaseModel):
    enabled: bool = True
    status: str = "ready"
    message: str | None = None
    mode: str = "neo4j"
    partial: bool = False
    stats: KnowledgeGraphStatsPublic = Field(default_factory=KnowledgeGraphStatsPublic)
    nodes: list[KnowledgeGraphNodePublic]
    edges: list[KnowledgeGraphEdgePublic]
    links: list[KnowledgeGraphEdgePublic] = Field(default_factory=list)


class ToolStatusPublic(BaseModel):
    key: str
    label: str
    status: str
    description: str
    endpoint: str | None = None


class AdvancedNotificationPublic(BaseModel):
    id: str
    action: str
    title: str
    message: str
    level: str
    created_at: datetime


class DeploymentStatusPublic(BaseModel):
    key: str
    label: str
    status: str
    value: str
    description: str
