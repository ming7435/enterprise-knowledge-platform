from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.entities import (
    AuditLog,
    ChatSession,
    Document,
    User,
    WorkspaceSetting,
)
from app.schemas.modules import (
    AuditLogPublic,
    ChatAskRequest,
    ChatAskResponse,
    ChatSessionCreate,
    ChatSessionPublic,
    DocumentChunkPublic,
    DocumentCreate,
    DocumentPublic,
    KnowledgeBaseStatus,
    KnowledgeSearchResult,
    WorkspaceSettingPublic,
)
from app.services.workspace_service import require_workspace_member, write_audit_log
from app.api.deps import get_settings
from app.core.config import Settings
from app.services.document_service import (
    delete_workspace_document,
    list_workspace_chunks,
    search_workspace_chunks,
    sync_knowledge_base_counts,
    upload_document_content,
)
from app.services.rag_chat_service import ask_workspace_question

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
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
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
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
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
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    safe_limit = min(max(limit, 1), 50)
    return list_workspace_chunks(db, workspace_id=workspace_id, limit=safe_limit)


@router.get("/knowledge-base/search", response_model=list[KnowledgeSearchResult])
def search_knowledge_base(
    workspace_id: str,
    query: str,
    limit: int = 10,
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
    )
    db.commit()
    db.refresh(result["session"])
    return result


@router.get("/settings", response_model=list[WorkspaceSettingPublic])
def list_settings(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return db.execute(
        select(WorkspaceSetting).where(WorkspaceSetting.workspace_id == workspace_id)
    ).scalars().all()


@router.get("/audit-logs", response_model=list[AuditLogPublic])
def list_audit_logs(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_workspace_member(db, user=current_user, workspace_id=workspace_id)
    return db.execute(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    ).scalars().all()
