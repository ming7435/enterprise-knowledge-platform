from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import Document, DocumentChunk, KnowledgeBase, User, VectorIndex
from app.services.document_processing_service import (
    DocumentProcessingError,
    extract_document_text,
    split_text_into_chunks,
)
from app.services.storage_service import (
    LocalDocumentStorage,
    create_document_storage,
    delete_document_file,
    file_extension,
)
from app.services.workspace_service import write_audit_log


@dataclass(frozen=True)
class ChunkSearchResult:
    id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


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
    if knowledge_base.status == "empty":
        knowledge_base.status = "documents_uploaded"

    _parse_and_index_document(
        db,
        document=document,
        knowledge_base=knowledge_base,
        filename=filename,
        content_type=content_type,
        content=content,
    )

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


def list_workspace_chunks(
    db: Session,
    *,
    workspace_id: str,
    limit: int = 20,
) -> list[ChunkSearchResult]:
    chunks = db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.workspace_id == workspace_id)
        .order_by(DocumentChunk.created_at.desc(), DocumentChunk.chunk_index.asc())
        .limit(limit)
    ).scalars().all()
    return [_chunk_to_result(chunk, score=0.0) for chunk in chunks]


def _save_document_with_fallback(
    *,
    settings: Settings,
    workspace_id: str,
    document_id: str,
    filename: str,
    content: bytes,
    content_type: str | None,
) -> str:
    save_kwargs = {
        "workspace_id": workspace_id,
        "document_id": document_id,
        "filename": filename,
        "content": content,
        "content_type": content_type,
    }
    try:
        return create_document_storage(settings).save(**save_kwargs)
    except Exception:
        return LocalDocumentStorage(settings.local_storage_root).save(**save_kwargs)


def delete_workspace_document(
    db: Session,
    *,
    user: User,
    workspace_id: str,
    document_id: str,
    settings: Settings | None = None,
) -> Document:
    document = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在或不属于当前工作区",
        )

    chunks = db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == document.id)
    ).scalars().all()
    removed_chunks = len(chunks)
    knowledge_base = _get_knowledge_base(db, workspace_id)

    db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
    db.delete(document)

    knowledge_base.document_count = max(0, knowledge_base.document_count - 1)
    knowledge_base.chunk_count = max(0, knowledge_base.chunk_count - removed_chunks)
    knowledge_base.status = _knowledge_status_after_delete(knowledge_base)

    if settings is not None:
        delete_document_file(settings, document.file_path)

    write_audit_log(
        db,
        action="document.deleted",
        user_id=user.id,
        workspace_id=workspace_id,
        target_type="document",
        target_id=document.id,
        detail={
            "filename": document.filename,
            "removed_chunks": removed_chunks,
        },
    )
    db.flush()
    return document


def search_workspace_chunks(
    db: Session,
    *,
    workspace_id: str,
    query: str,
    limit: int = 10,
) -> list[ChunkSearchResult]:
    normalized_query = query.strip().lower()
    if not normalized_query:
        return list_workspace_chunks(db, workspace_id=workspace_id, limit=limit)

    terms = [term for term in normalized_query.split() if term]
    chunks = db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.workspace_id == workspace_id)
        .order_by(DocumentChunk.created_at.desc())
    ).scalars().all()

    scored: list[ChunkSearchResult] = []
    for chunk in chunks:
        content = chunk.content.lower()
        score = _score_chunk(content, normalized_query, terms)
        if score > 0:
            scored.append(_chunk_to_result(chunk, score=score))

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def sync_knowledge_base_counts(db: Session, *, workspace_id: str) -> KnowledgeBase:
    knowledge_base = _get_knowledge_base(db, workspace_id)
    document_count = db.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.workspace_id == workspace_id)
    ).scalar_one()
    chunk_count = db.execute(
        select(func.count())
        .select_from(DocumentChunk)
        .where(DocumentChunk.workspace_id == workspace_id)
    ).scalar_one()
    knowledge_base.document_count = int(document_count)
    knowledge_base.chunk_count = int(chunk_count)
    knowledge_base.status = _knowledge_status_after_delete(knowledge_base)
    db.flush()
    return knowledge_base


def _parse_and_index_document(
    db: Session,
    *,
    document: Document,
    knowledge_base: KnowledgeBase,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> None:
    document.parse_status = "parsing"
    vector_index = db.execute(
        select(VectorIndex).where(VectorIndex.workspace_id == document.workspace_id)
    ).scalar_one_or_none()
    chunk_size = vector_index.chunk_size if vector_index else 800
    chunk_overlap = vector_index.chunk_overlap if vector_index else 120

    try:
        parsed = extract_document_text(
            filename=filename,
            content_type=content_type,
            content=content,
        )
        chunks = split_text_into_chunks(
            parsed.text,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        if not chunks:
            raise DocumentProcessingError("未从文档中提取到可入库文本")
    except DocumentProcessingError as exc:
        document.parse_status = "failed"
        document.index_status = "failed"
        write_audit_log(
            db,
            action="document.parse_failed",
            user_id=document.user_id,
            workspace_id=document.workspace_id,
            target_type="document",
            target_id=document.id,
            detail={"filename": document.filename, "reason": str(exc)},
        )
        return

    for index, chunk in enumerate(chunks):
        db.add(
            DocumentChunk(
                workspace_id=document.workspace_id,
                document_id=document.id,
                chunk_index=index,
                content=chunk,
                metadata_json={
                    "filename": document.filename,
                    "file_type": document.file_type,
                    "parser": parsed.parser,
                    "permission_scope": document.permission_scope,
                },
            )
        )

    document.parse_status = "parsed"
    document.index_status = "indexed"
    document.chunk_count = len(chunks)
    knowledge_base.chunk_count += len(chunks)
    knowledge_base.status = "ready"
    write_audit_log(
        db,
        action="document.parsed",
        user_id=document.user_id,
        workspace_id=document.workspace_id,
        target_type="document",
        target_id=document.id,
        detail={
            "filename": document.filename,
            "chunk_count": len(chunks),
            "parser": parsed.parser,
        },
    )


def _get_knowledge_base(db: Session, workspace_id: str) -> KnowledgeBase:
    return db.execute(
        select(KnowledgeBase).where(KnowledgeBase.workspace_id == workspace_id)
    ).scalar_one()


def _knowledge_status_after_delete(knowledge_base: KnowledgeBase) -> str:
    if knowledge_base.document_count == 0:
        return "empty"
    if knowledge_base.chunk_count > 0:
        return "ready"
    return "documents_uploaded"


def _score_chunk(content: str, query: str, terms: list[str]) -> float:
    score = 0.0
    if query in content:
        score += 5.0 + content.count(query)
    for term in terms:
        if term in content:
            score += 1.0 + content.count(term) * 0.2
    if not terms and query in content:
        score += 1.0
    cjk_query_chars = {char for char in query if "\u4e00" <= char <= "\u9fff"}
    if cjk_query_chars:
        matched_chars = [char for char in cjk_query_chars if char in content]
        if len(matched_chars) >= 2:
            score += len(matched_chars) * 0.2
    return score


def _chunk_to_result(chunk: DocumentChunk, *, score: float) -> ChunkSearchResult:
    metadata = chunk.metadata_json or {}
    return ChunkSearchResult(
        id=chunk.id,
        document_id=chunk.document_id,
        filename=str(metadata.get("filename") or "未知文档"),
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        score=round(score, 2),
    )
