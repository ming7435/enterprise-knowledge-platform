from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.entities import (
    AuditLog,
    ChatSession,
    Document,
    User,
    utc_now,
)
from app.schemas.modules import (
    AdvancedNotificationPublic,
    AdvancedOverviewPublic,
    AuditLogPublic,
    ChatAskRequest,
    ChatAskResponse,
    ChatSessionCreate,
    ChatSessionPublic,
    DocumentContentPublic,
    DeploymentStatusPublic,
    DocumentChunkPublic,
    DocumentCreate,
    DocumentPublic,
    KnowledgeGraphPublic,
    KnowledgeBaseStatus,
    KnowledgeSearchResult,
    ToolStatusPublic,
    WorkspaceSettingPublic,
    WorkspaceModelConnectionTestRequest,
    WorkspaceModelConnectionTestResponse,
    WorkspaceSettingUpdate,
)
from app.services.advanced_service import (
    build_advanced_overview,
    build_deployment_status,
    list_advanced_notifications,
    list_tool_statuses,
)
from app.services.neo4j_graph_service import (
    getNodeDetail,
    getRelatedNodes,
    getWorkspaceKnowledgeGraph,
    rebuildWorkspaceKnowledgeGraph,
    searchGraphNodes,
)
from app.services.workspace_service import (
    WORKSPACE_MANAGE_ROLES,
    WORKSPACE_WRITE_ROLES,
    require_workspace_member,
    require_workspace_role,
    write_audit_log,
)
from app.api.deps import get_settings
from app.core.config import Settings
from app.services.document_service import (
    delete_workspace_document,
    get_workspace_document_content,
    list_workspace_chunks,
    search_workspace_chunks,
    sync_knowledge_base_counts,
    upload_document_content,
)
from app.services.rag_chat_service import ask_workspace_question
from app.services.workspace_settings_service import (
    list_workspace_settings,
    test_workspace_model_api_connection,
    upsert_workspace_setting,
)

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["workspace-modules"])


@router.get("/documents", response_model=list[DocumentPublic])
def list_documents(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    ).scalars().all()


@router.post(
    "/documents/upload",
    response_model=DocumentPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    workspace_id: str,
    file: UploadFile = File(...),
    permission_scope: str = Form(default="workspace"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_WRITE_ROLES,
    )
    content = await file.read()
    document = upload_document_content(
        db,
        settings=settings,
        user=current_user,
        workspace_id=workspace_id,
        filename=file.filename or "document",
        content_type=file.content_type,
        content=content,
        permission_scope=permission_scope,
    )
    db.commit()
    db.refresh(document)
    return document


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    workspace_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_WRITE_ROLES,
    )
    delete_workspace_document(
        db,
        settings=settings,
        user=current_user,
        workspace_id=workspace_id,
        document_id=document_id,
    )
    db.commit()


@router.post(
    "/documents",
    response_model=DocumentPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_document_record(
    workspace_id: str,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_WRITE_ROLES,
    )
    document = Document(
        workspace_id=workspace_id,
        user_id=current_user.id,
        filename=payload.filename,
        file_type=payload.file_type,
    )
    db.add(document)
    db.flush()
    write_audit_log(
        db,
        action="document.created",
        user_id=current_user.id,
        workspace_id=workspace_id,
        target_type="document",
        target_id=document.id,
        detail={"filename": document.filename},
    )
    db.commit()
    db.refresh(document)
    return document


@router.get("/knowledge-base", response_model=KnowledgeBaseStatus)
def get_knowledge_base(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    knowledge_base = sync_knowledge_base_counts(db, workspace_id=workspace_id)
    db.commit()
    db.refresh(knowledge_base)
    return knowledge_base


@router.get("/knowledge-base/chunks", response_model=list[DocumentChunkPublic])
def get_knowledge_base_chunks(
    workspace_id: str,
    limit: int = 20,
    document_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    safe_limit = min(max(limit, 1), 500)
    return list_workspace_chunks(
        db,
        workspace_id=workspace_id,
        limit=safe_limit,
        document_ids=_parse_document_ids(document_ids),
    )


@router.get("/knowledge-base/search", response_model=list[KnowledgeSearchResult])
def search_knowledge_base(
    workspace_id: str,
    query: str,
    limit: int = 10,
    document_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    safe_limit = min(max(limit, 1), 20)
    return search_workspace_chunks(
        db,
        workspace_id=workspace_id,
        query=query,
        limit=safe_limit,
        document_ids=_parse_document_ids(document_ids),
    )


@router.get("/documents/{document_id}/content", response_model=DocumentContentPublic)
def get_document_content(
    workspace_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return get_workspace_document_content(
        db,
        workspace_id=workspace_id,
        document_id=document_id,
    )


@router.get("/chat-sessions", response_model=list[ChatSessionPublic])
def list_chat_sessions(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return db.execute(
        select(ChatSession)
        .where(ChatSession.workspace_id == workspace_id)
        .order_by(ChatSession.created_at.desc())
    ).scalars().all()


@router.post(
    "/chat-sessions",
    response_model=ChatSessionPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_chat_session(
    workspace_id: str,
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    session = ChatSession(
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=payload.title,
        mode=payload.mode,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/chat/ask", response_model=ChatAskResponse)
def ask_chat(
    workspace_id: str,
    payload: ChatAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    result = ask_workspace_question(
        db,
        settings=settings,
        user=current_user,
        workspace_id=workspace_id,
        question=payload.question,
        session_id=payload.session_id,
        top_k=payload.top_k,
        document_ids=payload.document_ids,
        use_knowledge_base=payload.use_knowledge_base,
    )
    db.commit()
    db.refresh(result["session"])
    return result


@router.get("/advanced/overview", response_model=AdvancedOverviewPublic)
def get_advanced_overview(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return build_advanced_overview(db, settings=settings, workspace_id=workspace_id)


@router.get("/advanced/knowledge-graph", response_model=KnowledgeGraphPublic)
def get_advanced_knowledge_graph(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return getWorkspaceKnowledgeGraph(db, settings=settings, workspace_id=workspace_id)


@router.get("/knowledge-graph", response_model=KnowledgeGraphPublic)
def get_knowledge_graph(
    workspace_id: str,
    limit: int = 100,
    edge_limit: int = 200,
    node_types: str | None = None,
    document_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return getWorkspaceKnowledgeGraph(
        db,
        settings=settings,
        workspace_id=workspace_id,
        limit=limit,
        edge_limit=edge_limit,
        node_types=_parse_node_types(node_types),
        document_ids=_parse_document_ids(document_ids),
    )


@router.get("/knowledge-graph/search")
def search_knowledge_graph(
    workspace_id: str,
    query: str,
    limit: int = 20,
    document_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return searchGraphNodes(
        db,
        settings,
        workspace_id=workspace_id,
        query=query,
        limit=limit,
        document_ids=_parse_document_ids(document_ids),
    )


@router.get("/knowledge-graph/nodes/{node_id}")
def get_knowledge_graph_node(
    workspace_id: str,
    node_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return getNodeDetail(db, settings, workspace_id=workspace_id, node_id=node_id)


@router.get("/knowledge-graph/nodes/{node_id}/neighbors")
def get_knowledge_graph_neighbors(
    workspace_id: str,
    node_id: str,
    depth: int = 1,
    limit: int = 40,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return getRelatedNodes(
        db,
        settings,
        workspace_id=workspace_id,
        node_id=node_id,
        depth=depth,
        limit=limit,
    )


@router.post("/knowledge-graph/rebuild", response_model=KnowledgeGraphPublic)
def rebuild_knowledge_graph(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    result = rebuildWorkspaceKnowledgeGraph(
        db,
        settings=settings,
        workspace_id=workspace_id,
    )
    write_audit_log(
        db,
        action="graph.rebuilt",
        user_id=current_user.id,
        workspace_id=workspace_id,
        target_type="knowledge_graph",
        target_id=workspace_id,
        detail={
            "status": result.get("status"),
            "enabled": result.get("enabled"),
        },
    )
    db.commit()
    return result


@router.get("/advanced/tool-center", response_model=list[ToolStatusPublic])
def get_advanced_tool_center(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return list_tool_statuses(settings)


@router.get(
    "/advanced/notifications",
    response_model=list[AdvancedNotificationPublic],
)
def get_advanced_notifications(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return list_advanced_notifications(db, workspace_id=workspace_id)


@router.get("/advanced/deployment", response_model=list[DeploymentStatusPublic])
def get_advanced_deployment(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return build_deployment_status(db, settings=settings, workspace_id=workspace_id)


@router.get("/settings", response_model=list[WorkspaceSettingPublic])
def list_settings(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace, _membership = require_workspace_member(
        db,
        user=current_user,
        workspace_id=workspace_id,
    )
    return list_workspace_settings(db, workspace=workspace)


@router.put("/settings/{setting_key}", response_model=WorkspaceSettingPublic)
def update_setting(
    workspace_id: str,
    setting_key: str,
    payload: WorkspaceSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    workspace, _membership = require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    result = upsert_workspace_setting(
        db,
        workspace=workspace,
        setting_key=setting_key,
        setting_value=payload.setting_value,
        setting_type=payload.setting_type,
    )
    write_audit_log(
        db,
        action="workspace.setting_updated",
        user_id=current_user.id,
        workspace_id=workspace_id,
        target_type="workspace_setting",
        target_id=setting_key,
        detail={"setting_key": setting_key},
    )
    db.commit()
    return result


@router.post(
    "/settings/model-api/test",
    response_model=WorkspaceModelConnectionTestResponse,
)
def test_model_api_connection(
    workspace_id: str,
    payload: WorkspaceModelConnectionTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    workspace, _membership = require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    result = test_workspace_model_api_connection(
        db,
        workspace=workspace,
        setting_key=payload.setting_key,
        setting_value=payload.setting_value,
        settings=settings,
    )
    write_audit_log(
        db,
        action="workspace.model_api_tested",
        user_id=current_user.id,
        workspace_id=workspace_id,
        target_type="workspace_setting",
        target_id=payload.setting_key,
        detail={
            "ok": result["ok"],
            "provider": result["provider"],
            "model_name": result["model_name"],
        },
    )
    db.commit()
    return result


@router.get("/audit-logs", response_model=list[AuditLogPublic])
def list_audit_logs(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    return db.execute(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    ).scalars().all()


@router.delete("/audit-logs")
def delete_audit_logs(
    workspace_id: str,
    retention_days: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    filters = [AuditLog.workspace_id == workspace_id]
    if retention_days is not None:
        if retention_days < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="保留天数必须大于 0",
            )
        cutoff = utc_now() - timedelta(days=retention_days)
        filters.append(AuditLog.created_at < cutoff)
    audit_logs = db.execute(select(AuditLog).where(*filters)).scalars().all()
    deleted_count = len(audit_logs)
    for audit_log in audit_logs:
        db.delete(audit_log)
    db.commit()
    return {"deleted_count": deleted_count}


@router.delete("/audit-logs/{audit_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audit_log(
    workspace_id: str,
    audit_log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_role(
        db,
        user=current_user,
        workspace_id=workspace_id,
        allowed_roles=WORKSPACE_MANAGE_ROLES,
    )
    audit_log = db.execute(
        select(AuditLog).where(
            AuditLog.id == audit_log_id,
            AuditLog.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()
    if audit_log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计日志不存在",
        )
    db.delete(audit_log)
    db.commit()


def _parse_document_ids(value: str | None) -> list[str] | None:
    if not value:
        return None
    document_ids = [item.strip() for item in value.split(",") if item.strip()]
    return document_ids or None


def _parse_node_types(value: str | None) -> list[str] | None:
    if not value:
        return None
    node_types = [item.strip() for item in value.split(",") if item.strip()]
    return node_types or None
