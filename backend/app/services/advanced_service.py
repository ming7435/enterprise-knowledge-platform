from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import (
    AuditLog,
    Document,
    DocumentChunk,
    KnowledgeBase,
    VectorIndex,
    Workspace,
    WorkspaceMember,
)


CONCEPT_KEYWORDS = (
    "合同",
    "审批",
    "权限",
    "风险",
    "知识库",
    "知识图谱",
    "问答",
    "审计",
    "数据隔离",
    "来源",
    "向量",
    "文档",
    "成员",
    "企业",
    "流程",
)

ACTION_LABELS = {
    "document.created": ("文档已创建", "新增了文档记录"),
    "document.uploaded": ("文档已上传", "文档已进入解析与索引流程"),
    "document.asset_saved": ("文件资产已保存", "暂不支持解析的文件已作为资产保存"),
    "document.deleted": ("文档已删除", "文档与知识片段已从当前工作区移除"),
    "workspace.created": ("工作区已创建", "新的工作区已准备好"),
    "workspace.deleted": ("工作区已删除", "工作区及关联数据已清理"),
    "member.added": ("成员已加入", "工作区成员列表发生变化"),
    "member.removed": ("成员已移除", "工作区成员权限发生变化"),
    "member.updated": ("成员已更新", "工作区成员角色或状态已调整"),
    "chat.asked": ("问答已完成", "大模型根据知识库生成了一次回答"),
}


def build_advanced_overview(
    db: Session, *, settings: Settings, workspace_id: str
) -> dict:
    vector_index = db.execute(
        select(VectorIndex).where(VectorIndex.workspace_id == workspace_id)
    ).scalar_one_or_none()
    latest_audit = db.execute(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    return {
        "workspace_id": workspace_id,
        "document_count": _count_documents(db, workspace_id),
        "chunk_count": _count(db, DocumentChunk, workspace_id),
        "member_count": _count_active_members(db, workspace_id),
        "audit_log_count": _count(db, AuditLog, workspace_id),
        "vector_status": _vector_status(settings, vector_index),
        "graph_status": f"{settings.graph_db}-ready",
        "rerank_status": "ready"
        if Path(settings.rerank_model_path).exists()
        else "missing",
        "latest_activity_at": latest_audit.created_at if latest_audit else None,
    }


def build_knowledge_graph(db: Session, *, workspace_id: str) -> dict:
    workspace = db.get(Workspace, workspace_id)
    documents = db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id, Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc())
        .limit(20)
    ).scalars().all()
    chunks = db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.workspace_id == workspace_id)
        .order_by(DocumentChunk.created_at.desc())
        .limit(80)
    ).scalars().all()

    nodes = [
        {
            "id": f"workspace:{workspace_id}",
            "label": workspace.name if workspace else "当前工作区",
            "type": "workspace",
            "weight": max(len(documents), 1),
        }
    ]
    edges = []
    document_by_id = {document.id: document for document in documents}
    concept_counter: Counter[str] = Counter()
    document_concepts: dict[str, set[str]] = {}

    for document in documents:
        nodes.append(
            {
                "id": f"document:{document.id}",
                "label": document.filename,
                "type": "document",
                "weight": max(document.chunk_count, 1),
            }
        )
        edges.append(
            {
                "id": f"workspace-document:{document.id}",
                "source": f"workspace:{workspace_id}",
                "target": f"document:{document.id}",
                "label": "包含文档",
                "weight": max(document.chunk_count, 1),
            }
        )

    for chunk in chunks:
        if chunk.document_id not in document_by_id:
            continue
        concepts = _extract_concepts(chunk.content)
        if not concepts:
            concepts = {_document_stem(document_by_id[chunk.document_id].filename)}
        document_concepts.setdefault(chunk.document_id, set()).update(concepts)
        concept_counter.update(concepts)

    for concept, count in concept_counter.most_common(16):
        nodes.append(
            {
                "id": f"concept:{concept}",
                "label": concept,
                "type": "concept",
                "weight": count,
            }
        )

    included_concepts = {concept for concept, _ in concept_counter.most_common(16)}
    for document_id, concepts in document_concepts.items():
        for concept in sorted(concepts & included_concepts):
            edges.append(
                {
                    "id": f"document-concept:{document_id}:{concept}",
                    "source": f"document:{document_id}",
                    "target": f"concept:{concept}",
                    "label": "包含概念",
                    "weight": concept_counter[concept],
                }
            )

    return {"nodes": nodes, "edges": edges}


def list_tool_statuses(settings: Settings) -> list[dict]:
    rerank_exists = Path(settings.rerank_model_path).exists()
    return [
        {
            "key": "milvus",
            "label": "Milvus 向量数据库",
            "status": "configured",
            "description": "用于存储文档向量和召回结果，支持后续扩展为生产向量检索。",
            "endpoint": f"{settings.milvus_host}:{settings.milvus_grpc_port}",
        },
        {
            "key": "neo4j",
            "label": "Neo4j 知识图谱",
            "status": "configured",
            "description": "用于沉淀实体、关系和知识路径，V5 驾驶舱会展示图谱预览。",
            "endpoint": _hide_credentials(settings.neo4j_uri),
        },
        {
            "key": "rerank",
            "label": "BGE Rerank 重排模型",
            "status": "ready" if rerank_exists else "missing",
            "description": "用于提升召回片段排序质量，路径由 RERANK_MODEL_PATH 控制。",
            "endpoint": settings.rerank_model_path,
        },
        {
            "key": "minio",
            "label": "MinIO 对象存储",
            "status": "configured",
            "description": "用于承载上传文件和后续归档对象，界面只展示地址不展示密钥。",
            "endpoint": settings.minio_endpoint,
        },
        {
            "key": "n8n",
            "label": "n8n 自动化工作流",
            "status": "configured",
            "description": "用于后续接入审批、通知、同步和知识库处理自动化。",
            "endpoint": settings.n8n_url,
        },
        {
            "key": "ollama",
            "label": "Ollama 本地模型",
            "status": "configured",
            "description": "用于本地大模型兜底或私有化推理场景。",
            "endpoint": settings.ollama_base_url,
        },
    ]


def list_advanced_notifications(
    db: Session, *, workspace_id: str, limit: int = 20
) -> list[dict]:
    logs = db.execute(
        select(AuditLog)
        .where(AuditLog.workspace_id == workspace_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    ).scalars().all()

    notifications = []
    for log in logs:
        title, fallback = ACTION_LABELS.get(log.action, ("系统动态", log.action))
        filename = (log.detail or {}).get("filename")
        message = f"{fallback}：{filename}" if filename else fallback
        notifications.append(
            {
                "id": log.id,
                "action": log.action,
                "title": title,
                "message": message,
                "level": "info",
                "created_at": log.created_at,
            }
        )
    return notifications


def build_deployment_status(
    db: Session, *, settings: Settings, workspace_id: str
) -> list[dict]:
    knowledge_base = db.execute(
        select(KnowledgeBase).where(KnowledgeBase.workspace_id == workspace_id)
    ).scalar_one_or_none()

    return [
        {
            "key": "database",
            "label": "关系型数据库",
            "status": "configured",
            "value": _safe_database_label(settings.database_url),
            "description": "承载用户、工作区、文档、权限和审计等核心结构化数据。",
        },
        {
            "key": "storage",
            "label": "文件存储",
            "status": "configured",
            "value": settings.file_storage,
            "description": "负责保存上传原文和后续解析产物，不展示访问密钥。",
        },
        {
            "key": "rerank_model",
            "label": "重排模型",
            "status": "ready"
            if Path(settings.rerank_model_path).exists()
            else "missing",
            "value": settings.rerank_model_path,
            "description": "用于对召回片段做二次排序，提升问答答案可信度。",
        },
        {
            "key": "vector_store",
            "label": "向量检索",
            "status": "configured",
            "value": settings.vector_store,
            "description": "面向知识库语义召回，默认使用 Milvus。",
        },
        {
            "key": "graph_db",
            "label": "图数据库",
            "status": "configured",
            "value": settings.graph_db,
            "description": "面向实体关系、来源链路和知识导航，默认使用 Neo4j。",
        },
        {
            "key": "knowledge_base",
            "label": "知识库状态",
            "status": knowledge_base.status if knowledge_base else "empty",
            "value": f"{knowledge_base.chunk_count if knowledge_base else 0} 个片段",
            "description": "展示当前工作区知识库可检索数据规模。",
        },
    ]


def _count(db: Session, model: type, workspace_id: str) -> int:
    return int(
        db.execute(
            select(func.count()).select_from(model).where(model.workspace_id == workspace_id)
        ).scalar_one()
    )


def _count_documents(db: Session, workspace_id: str) -> int:
    """统计未软删除的文档数量。"""
    return int(
        db.execute(
            select(func.count())
            .select_from(Document)
            .where(Document.workspace_id == workspace_id, Document.deleted_at.is_(None))
        ).scalar_one()
    )


def _count_active_members(db: Session, workspace_id: str) -> int:
    return int(
        db.execute(
            select(func.count())
            .select_from(WorkspaceMember)
            .where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.status == "active",
            )
        ).scalar_one()
    )


def _vector_status(settings: Settings, vector_index: VectorIndex | None) -> str:
    if vector_index:
        return f"{vector_index.vector_type}-ready"
    return f"{settings.vector_store}-configured"


def _extract_concepts(content: str) -> set[str]:
    concepts = {keyword for keyword in CONCEPT_KEYWORDS if keyword in content}
    for token in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,24}", content):
        if token.lower() not in {"the", "and", "for", "http", "https"}:
            concepts.add(token)
    return {concept for concept in concepts if concept}


def _document_stem(filename: str) -> str:
    stem = Path(filename).stem.strip()
    return stem[:24] or "未命名文档"


def _hide_credentials(value: str) -> str:
    return re.sub(r"//[^:@/]+:[^@/]+@", "//***:***@", value)


def _safe_database_label(database_url: str) -> str:
    if database_url.startswith("sqlite"):
        return "sqlite"
    if "://" in database_url:
        return database_url.split("://", 1)[0]
    return "configured"
