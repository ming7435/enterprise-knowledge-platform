from __future__ import annotations

import hashlib
import mimetypes
from uuid import uuid4

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import delete, func, select

from app.core.config import Settings
from app.db.session import create_session_factory
from app.models.entities import Document, DocumentChunk, KnowledgeBase, User
from app.services.document_service import (
    _get_knowledge_base,
    _parse_and_index_document,
    _save_document_with_fallback,
)
from app.services.storage_service import file_extension, read_document_file
from app.services.workspace_service import write_audit_log


def create_queued_document(
    db,
    *,
    settings: Settings,
    user: User,
    workspace_id: str,
    filename: str,
    content_type: str | None,
    content: bytes,
    permission_scope: str = "workspace",
) -> Document:
    content_hash = hashlib.sha256(content).hexdigest()
    duplicate = db.execute(
        select(Document).where(
            Document.workspace_id == workspace_id,
            Document.content_hash == content_hash,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"相同内容的文档已存在：{duplicate.filename}",
        )

    previous_version = db.execute(
        select(func.max(Document.version)).where(
            Document.workspace_id == workspace_id,
            Document.filename == filename,
        )
    ).scalar_one()
    document = Document(
        workspace_id=workspace_id,
        user_id=user.id,
        filename=filename,
        file_type=file_extension(filename, content_type),
        parse_status="queued",
        index_status="pending",
        chunk_count=0,
        processing_progress=5,
        processing_stage="uploaded",
        task_id=str(uuid4()),
        content_hash=content_hash,
        version=int(previous_version or 0) + 1,
        permission_scope=permission_scope,
    )
    db.add(document)
    db.flush()
    document.file_path = _save_document_with_fallback(
        settings=settings,
        workspace_id=workspace_id,
        document_id=document.id,
        filename=filename,
        content=content,
        content_type=content_type,
    )
    knowledge_base = _get_knowledge_base(db, workspace_id)
    knowledge_base.document_count += 1
    knowledge_base.status = "building"
    write_audit_log(
        db,
        action="document.queued",
        user_id=user.id,
        workspace_id=workspace_id,
        target_type="document",
        target_id=document.id,
        detail={"filename": filename, "task_id": document.task_id, "version": document.version},
    )
    db.flush()
    return document


def enqueue_document_processing(
    *,
    settings: Settings,
    document: Document,
    background_tasks: BackgroundTasks,
) -> str:
    if settings.celery_enabled:
        from app.tasks.document_tasks import process_document_task

        result = process_document_task.delay(document.id)
        document.task_id = result.id
        return result.id
    background_tasks.add_task(process_document_by_id, settings, document_id=document.id)
    return document.task_id or document.id


def process_document_by_id(
    settings: Settings,
    *,
    document_id: str,
    raise_on_error: bool = False,
) -> None:
    session_factory, engine = create_session_factory(settings.database_url)
    db = session_factory()
    try:
        document = db.execute(
            select(Document).where(Document.id == document_id, Document.deleted_at.is_(None))
        ).scalar_one_or_none()
        if document is None:
            return
        knowledge_base = _get_knowledge_base(db, document.workspace_id)
        existing_count = db.execute(
            select(func.count())
            .select_from(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
        ).scalar_one()
        if existing_count:
            db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
            knowledge_base.chunk_count = max(0, knowledge_base.chunk_count - int(existing_count))

        document.parse_status = "parsing"
        document.index_status = "pending"
        document.processing_progress = 15
        document.processing_stage = "reading"
        document.processing_error = None
        db.commit()

        content = read_document_file(settings, document.file_path)
        document.processing_progress = 30
        document.processing_stage = "parsing"
        _parse_and_index_document(
            db,
            settings=settings,
            document=document,
            knowledge_base=knowledge_base,
            filename=document.filename,
            content_type=mimetypes.guess_type(document.filename)[0],
            content=content,
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        document = db.get(Document, document_id)
        if document is not None:
            document.parse_status = "failed"
            document.index_status = "failed"
            document.processing_stage = "failed"
            document.processing_error = str(exc)[:2000]
            write_audit_log(
                db,
                action="document.process_failed",
                user_id=document.user_id,
                workspace_id=document.workspace_id,
                target_type="document",
                target_id=document.id,
                detail={"filename": document.filename, "reason": document.processing_error},
            )
            db.commit()
        if raise_on_error:
            raise
    finally:
        db.close()
        engine.dispose()


def requeue_document(db, *, document: Document) -> Document:
    if document.parse_status in {"queued", "parsing"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="文档正在处理中，请稍后再试")
    document.parse_status = "queued"
    document.index_status = "pending"
    document.processing_progress = 0
    document.processing_stage = "waiting"
    document.processing_error = None
    document.task_id = str(uuid4())
    db.flush()
    return document
