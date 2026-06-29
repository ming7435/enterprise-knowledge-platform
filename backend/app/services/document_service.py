from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import Document, KnowledgeBase, User
from app.services.storage_service import create_document_storage, file_extension
from app.services.workspace_service import write_audit_log


def upload_document_content(
    db: Session,
    *,
    settings: Settings,
    user: User,
    workspace_id: str,
    filename: str,
    content_type: str | None,
    content: bytes,
    permission_scope: str = "workspace",
) -> Document:
    document = Document(
        workspace_id=workspace_id,
        user_id=user.id,
        filename=filename,
        file_type=file_extension(filename, content_type),
        parse_status="uploaded",
        index_status="pending",
        chunk_count=0,
        permission_scope=permission_scope,
    )
    db.add(document)
    db.flush()

    storage = create_document_storage(settings)
    document.file_path = storage.save(
        workspace_id=workspace_id,
        document_id=document.id,
        filename=filename,
        content=content,
        content_type=content_type,
    )

    knowledge_base = db.execute(
        select(KnowledgeBase).where(KnowledgeBase.workspace_id == workspace_id)
    ).scalar_one()
    knowledge_base.document_count += 1
    if knowledge_base.status == "empty":
        knowledge_base.status = "documents_uploaded"

    write_audit_log(
        db,
        action="document.uploaded",
        user_id=user.id,
        workspace_id=workspace_id,
        target_type="document",
        target_id=document.id,
        detail={
            "filename": document.filename,
            "file_type": document.file_type,
            "permission_scope": permission_scope,
        },
    )
    db.flush()
    return document
