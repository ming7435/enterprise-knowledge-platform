from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import Document, DocumentChunk, KnowledgeBase, User, VectorIndex, utc_now
from app.services.document_processing_service import (
    DocumentProcessingError,
    UnsupportedAssetError,
    extract_document_text,
    split_parsed_document_into_chunks,
)
from app.services.embedding_service import EmbeddingUnavailableError, embed_query, embed_texts
from app.services.retrieval_service import (
    RetrievalCandidate,
    bm25_rank,
    reciprocal_rank_fusion,
    rerank_candidates,
    tokenize_for_retrieval,
)
from app.services.storage_service import (
    LocalDocumentStorage,
    create_document_storage,
    delete_document_file,
    file_extension,
)
from app.services.workspace_service import write_audit_log
from app.services.vector_store_service import (
    VectorStoreUnavailableError,
    delete_document_vectors,
    search_chunk_vectors,
    upsert_chunk_vectors,
)


@dataclass(frozen=True)
class ChunkSearchResult:
    id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float
    page_number: int | None = None
    section: str | None = None
    retrieval_method: str = "list"


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
        settings=settings,
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
    document_ids: list[str] | None = None,
) -> list[ChunkSearchResult]:
    filters = [DocumentChunk.workspace_id == workspace_id]
    if document_ids:
        filters.append(DocumentChunk.document_id.in_(document_ids))
    chunks = db.execute(
        select(DocumentChunk)
        .where(*filters)
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
            Document.deleted_at.is_(None),
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
    # 软删除：只标记删除时间，保留记录用于审计和恢复
    document.deleted_at = utc_now()

    knowledge_base.document_count = max(0, knowledge_base.document_count - 1)
    knowledge_base.chunk_count = max(0, knowledge_base.chunk_count - removed_chunks)
    knowledge_base.status = _knowledge_status_after_delete(knowledge_base)

    if settings is not None:
        if settings.vector_index_enabled:
            delete_document_vectors(
                settings,
                workspace_id=workspace_id,
                document_id=document.id,
            )
        _sync_document_delete_to_graph(
            db,
            settings=settings,
            workspace_id=workspace_id,
            document_id=document.id,
            user_id=user.id,
            filename=document.filename,
        )
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
    document_ids: list[str] | None = None,
    settings: Settings | None = None,
) -> list[ChunkSearchResult]:
    normalized_query = query.strip().lower()
    if not normalized_query:
        return list_workspace_chunks(
            db,
            workspace_id=workspace_id,
            limit=limit,
            document_ids=document_ids,
        )

    if settings is None:
        return _legacy_keyword_search(
            db,
            workspace_id=workspace_id,
            normalized_query=normalized_query,
            limit=limit,
            document_ids=document_ids,
        )

    candidate_limit = max(limit, settings.retrieval_candidate_limit)
    keyword_chunks = _load_keyword_candidates(
        db,
        workspace_id=workspace_id,
        query=normalized_query,
        limit=candidate_limit,
        document_ids=document_ids,
    )
    keyword_candidates = bm25_rank(
        normalized_query,
        [_chunk_to_candidate(chunk) for chunk in keyword_chunks],
        limit=candidate_limit,
    )
    rankings: dict[str, list[RetrievalCandidate]] = {"bm25": keyword_candidates}

    if settings.vector_index_enabled and settings.retrieval_mode in {"hybrid", "vector"}:
        try:
            vector_hits = search_chunk_vectors(
                settings,
                workspace_id=workspace_id,
                query_vector=embed_query(settings, normalized_query),
                limit=candidate_limit,
                document_ids=document_ids,
            )
            vector_chunks = _load_chunks_by_ids(
                db,
                workspace_id=workspace_id,
                chunk_ids=[hit.chunk_id for hit in vector_hits],
                document_ids=document_ids,
            )
            chunks_by_id = {chunk.id: chunk for chunk in vector_chunks}
            rankings["vector"] = [
                RetrievalCandidate(
                    **_chunk_candidate_kwargs(chunks_by_id[hit.chunk_id]),
                    score=hit.score,
                    vector_score=hit.score,
                    retrieval_method="vector",
                )
                for hit in vector_hits
                if hit.chunk_id in chunks_by_id
            ]
        except (EmbeddingUnavailableError, VectorStoreUnavailableError):
            pass

    if settings.retrieval_mode == "vector" and rankings.get("vector"):
        fused = rankings["vector"][:candidate_limit]
    else:
        fused = reciprocal_rank_fusion(
            rankings,
            workspace_id=workspace_id,
            allowed_document_ids=set(document_ids) if document_ids else None,
            limit=candidate_limit,
        )
    if settings.rerank_enabled and fused:
        fused, _reason = rerank_candidates(
            normalized_query,
            fused,
            model_path=settings.rerank_model_path,
            limit=limit,
        )
    return [_candidate_to_result(item) for item in fused[:limit]]


def get_workspace_document_content(
    db: Session,
    *,
    workspace_id: str,
    document_id: str,
) -> dict:
    document = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在或不属于当前工作区",
        )
    chunks = db.execute(
        select(DocumentChunk)
        .where(
            DocumentChunk.workspace_id == workspace_id,
            DocumentChunk.document_id == document_id,
        )
        .order_by(DocumentChunk.chunk_index.asc())
    ).scalars().all()
    content = "\n\n".join(chunk.content for chunk in chunks)
    return {
        "document": document,
        "library_name": document.filename,
        "content": content,
        "chunk_count": len(chunks),
    }


def sync_knowledge_base_counts(db: Session, *, workspace_id: str) -> KnowledgeBase:
    knowledge_base = _get_knowledge_base(db, workspace_id)
    document_count = db.execute(
        select(func.count())
        .select_from(Document)
        .where(Document.workspace_id == workspace_id, Document.deleted_at.is_(None))
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
    settings: Settings,
    document: Document,
    knowledge_base: KnowledgeBase,
    filename: str,
    content_type: str | None,
    content: bytes,
) -> None:
    document.parse_status = "parsing"
    document.processing_progress = max(document.processing_progress, 35)
    document.processing_stage = "parsing"
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
        chunks = split_parsed_document_into_chunks(
            parsed,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        if not chunks:
            raise DocumentProcessingError("未从文档中提取到可入库文本")
    except UnsupportedAssetError as exc:
        document.parse_status = "unsupported"
        document.index_status = "asset_only"
        document.processing_progress = 100
        document.processing_stage = "asset_saved"
        document.processing_error = str(exc)
        write_audit_log(
            db,
            action="document.asset_saved",
            user_id=document.user_id,
            workspace_id=document.workspace_id,
            target_type="document",
            target_id=document.id,
            detail={"filename": document.filename, "reason": str(exc)},
        )
        return
    except DocumentProcessingError as exc:
        document.parse_status = "failed"
        document.index_status = "failed"
        document.processing_stage = "failed"
        document.processing_error = str(exc)
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

    document.processing_progress = 65
    document.processing_stage = "indexing"
    chunk_models: list[DocumentChunk] = []
    for index, chunk in enumerate(chunks):
        chunk_model = DocumentChunk(
                workspace_id=document.workspace_id,
                document_id=document.id,
                chunk_index=index,
                content=chunk.content,
                page_number=chunk.page_number,
                section=chunk.section,
                token_count=chunk.token_count,
                content_hash=chunk.content_hash,
                metadata_json={
                    "filename": document.filename,
                    "file_type": document.file_type,
                    "parser": parsed.parser,
                    "permission_scope": document.permission_scope,
                    "page_number": chunk.page_number,
                    "section": chunk.section,
                    "source_position": chunk.source_position,
                    "token_count": chunk.token_count,
                    "content_hash": chunk.content_hash,
                },
            )
        db.add(chunk_model)
        chunk_models.append(chunk_model)
    db.flush()

    vector_error = _index_document_vectors(settings, document=document, chunks=chunk_models)

    document.parse_status = "parsed"
    document.index_status = "indexed"
    document.chunk_count = len(chunks)
    document.processing_progress = 100
    document.processing_stage = "completed"
    document.processing_error = vector_error
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
            "vector_status": "ready" if not vector_error else "keyword_only",
            "vector_error": vector_error,
        },
    )
    _sync_document_to_graph(
        db,
        settings=settings,
        document=document,
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
        page_number=chunk.page_number,
        section=chunk.section or metadata.get("section"),
        retrieval_method="list",
    )


def _legacy_keyword_search(
    db: Session,
    *,
    workspace_id: str,
    normalized_query: str,
    limit: int,
    document_ids: list[str] | None,
) -> list[ChunkSearchResult]:
    terms = [term for term in normalized_query.split() if term]
    filters = [DocumentChunk.workspace_id == workspace_id]
    if document_ids:
        filters.append(DocumentChunk.document_id.in_(document_ids))
    chunks = db.execute(select(DocumentChunk).where(*filters)).scalars().all()
    scored = []
    for chunk in chunks:
        score = _score_chunk(chunk.content.lower(), normalized_query, terms)
        if score > 0:
            result = _chunk_to_result(chunk, score=score)
            scored.append(ChunkSearchResult(**{**result.__dict__, "retrieval_method": "keyword"}))
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:limit]


def _load_keyword_candidates(
    db: Session,
    *,
    workspace_id: str,
    query: str,
    limit: int,
    document_ids: list[str] | None,
) -> list[DocumentChunk]:
    filters = [DocumentChunk.workspace_id == workspace_id]
    if document_ids:
        filters.append(DocumentChunk.document_id.in_(document_ids))
    tokens = [token for token in dict.fromkeys(tokenize_for_retrieval(query)) if len(token) > 1][:8]
    if tokens:
        filters.append(or_(*(DocumentChunk.content.ilike(f"%{token}%") for token in tokens)))
    return db.execute(
        select(DocumentChunk)
        .where(*filters)
        .order_by(DocumentChunk.created_at.desc())
        .limit(limit)
    ).scalars().all()


def _load_chunks_by_ids(
    db: Session,
    *,
    workspace_id: str,
    chunk_ids: list[str],
    document_ids: list[str] | None,
) -> list[DocumentChunk]:
    if not chunk_ids:
        return []
    filters = [DocumentChunk.workspace_id == workspace_id, DocumentChunk.id.in_(chunk_ids)]
    if document_ids:
        filters.append(DocumentChunk.document_id.in_(document_ids))
    return db.execute(select(DocumentChunk).where(*filters)).scalars().all()


def _chunk_candidate_kwargs(chunk: DocumentChunk) -> dict:
    metadata = chunk.metadata_json or {}
    return {
        "chunk_id": chunk.id,
        "workspace_id": chunk.workspace_id,
        "document_id": chunk.document_id,
        "filename": str(metadata.get("filename") or "未知文档"),
        "chunk_index": chunk.chunk_index,
        "content": chunk.content,
        "page_number": chunk.page_number,
        "section": chunk.section or metadata.get("section"),
        "metadata": metadata,
    }


def _chunk_to_candidate(chunk: DocumentChunk) -> RetrievalCandidate:
    return RetrievalCandidate(**_chunk_candidate_kwargs(chunk))


def _candidate_to_result(candidate: RetrievalCandidate) -> ChunkSearchResult:
    return ChunkSearchResult(
        id=candidate.chunk_id,
        document_id=candidate.document_id,
        filename=candidate.filename,
        chunk_index=candidate.chunk_index,
        content=candidate.content,
        score=round(candidate.score, 6),
        page_number=candidate.page_number,
        section=candidate.section,
        retrieval_method=candidate.retrieval_method,
    )


def _index_document_vectors(
    settings: Settings,
    *,
    document: Document,
    chunks: list[DocumentChunk],
) -> str | None:
    if not settings.vector_index_enabled or not chunks:
        return None
    try:
        vectors = embed_texts(settings, [chunk.content for chunk in chunks])
        upsert_chunk_vectors(
            settings,
            workspace_id=document.workspace_id,
            rows=[
                {
                    "chunk_id": chunk.id,
                    "document_id": document.id,
                    "chunk_index": chunk.chunk_index,
                }
                for chunk in chunks
            ],
            vectors=vectors,
        )
        for chunk in chunks:
            chunk.vector_id = chunk.id
        return None
    except (EmbeddingUnavailableError, VectorStoreUnavailableError, ValueError) as exc:
        return str(exc)


def _sync_document_to_graph(
    db: Session,
    *,
    settings: Settings,
    document: Document,
) -> None:
    if not settings.neo4j_enabled:
        return
    try:
        from app.services import neo4j_graph_service

        result = neo4j_graph_service.syncDocumentToNeo4j(
            db,
            settings=settings,
            workspace_id=document.workspace_id,
            document_id=document.id,
        )
        if result.get("status") in {"unavailable", "failed"}:
            write_audit_log(
                db,
                action="graph.document_sync_failed",
                user_id=document.user_id,
                workspace_id=document.workspace_id,
                target_type="document",
                target_id=document.id,
                detail={
                    "filename": document.filename,
                    "reason": result.get("message"),
                },
            )
    except Exception as exc:
        write_audit_log(
            db,
            action="graph.document_sync_failed",
            user_id=document.user_id,
            workspace_id=document.workspace_id,
            target_type="document",
            target_id=document.id,
            detail={"filename": document.filename, "reason": str(exc)},
        )


def _sync_document_delete_to_graph(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    document_id: str,
    user_id: str,
    filename: str,
) -> None:
    if not settings.neo4j_enabled:
        return
    try:
        from app.services import neo4j_graph_service

        result = neo4j_graph_service.deleteDocumentFromNeo4j(
            settings,
            workspace_id=workspace_id,
            document_id=document_id,
        )
        if result.get("status") in {"unavailable", "failed"}:
            write_audit_log(
                db,
                action="graph.document_delete_sync_failed",
                user_id=user_id,
                workspace_id=workspace_id,
                target_type="document",
                target_id=document_id,
                detail={"filename": filename, "reason": result.get("message")},
            )
    except Exception as exc:
        write_audit_log(
            db,
            action="graph.document_delete_sync_failed",
            user_id=user_id,
            workspace_id=workspace_id,
            target_type="document",
            target_id=document_id,
            detail={"filename": filename, "reason": str(exc)},
        )
