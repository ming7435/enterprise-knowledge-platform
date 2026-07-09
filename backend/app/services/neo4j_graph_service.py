from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.entities import Document, DocumentChunk

logger = logging.getLogger(__name__)

_driver: Any | None = None
_driver_signature: tuple[str, str, str] | None = None

MAX_NODES = 300
DEFAULT_NODE_LIMIT = 100
DEFAULT_EDGE_LIMIT = 200
ENTITY_NODE_TYPE = "entity"
FILE_RELATION_TYPE = "FILE_RELATION"


class Neo4jUnavailableError(RuntimeError):
    pass


def getNeo4jDriver(settings: Settings):
    global _driver, _driver_signature
    if not settings.neo4j_enabled:
        raise Neo4jUnavailableError("Neo4j is disabled")
    try:
        from neo4j import GraphDatabase
    except ImportError as exc:
        raise Neo4jUnavailableError("neo4j Python driver is not installed") from exc

    signature = (settings.neo4j_uri, settings.neo4j_username, settings.neo4j_password)
    if _driver is None or _driver_signature != signature:
        closeNeo4jDriver()
        auth = None
        if settings.neo4j_username:
            auth = (settings.neo4j_username, settings.neo4j_password)
        _driver = GraphDatabase.driver(settings.neo4j_uri, auth=auth)
        _driver_signature = signature
    return _driver


def closeNeo4jDriver() -> None:
    global _driver, _driver_signature
    if _driver is not None:
        _driver.close()
    _driver = None
    _driver_signature = None


def verifyNeo4jConnection(settings: Settings) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=None)
    try:
        driver = getNeo4jDriver(settings)
        driver.verify_connectivity()
    except Exception as exc:
        return {
            "enabled": True,
            "status": "unavailable",
            "message": f"Neo4j 图数据库暂不可用：{exc}",
        }
    return {"enabled": True, "status": "ready", "message": "Neo4j 已连接"}


def runNeo4jQuery(
    settings: Settings,
    cypher: str,
    parameters: dict | None = None,
    *,
    write: bool = False,
) -> list[dict]:
    driver = getNeo4jDriver(settings)
    params = parameters or {}

    def execute(tx):
        return [record.data() for record in tx.run(cypher, **params)]

    database = settings.neo4j_database or None
    with driver.session(database=database) as session:
        if write:
            return session.execute_write(execute)
        return session.execute_read(execute)


def initializeNeo4jSchema(settings: Settings) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=None)
    statements = [
        "CREATE CONSTRAINT workspace_node_id IF NOT EXISTS "
        "FOR (n:Workspace) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT document_node_id IF NOT EXISTS "
        "FOR (n:Document) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT chunk_node_id IF NOT EXISTS "
        "FOR (n:Chunk) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT keyword_node_id IF NOT EXISTS "
        "FOR (n:Keyword) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT concept_node_id IF NOT EXISTS "
        "FOR (n:Concept) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT question_node_id IF NOT EXISTS "
        "FOR (n:Question) REQUIRE n.id IS UNIQUE",
        "CREATE CONSTRAINT entity_node_id IF NOT EXISTS "
        "FOR (n:Entity) REQUIRE n.id IS UNIQUE",
        "CREATE INDEX graph_workspace_id IF NOT EXISTS "
        "FOR (n) ON (n.workspace_id)",
    ]
    try:
        for statement in statements:
            runNeo4jQuery(settings, statement, {}, write=True)
    except Exception as exc:
        return {
            "enabled": True,
            "status": "unavailable",
            "message": f"Neo4j schema 初始化失败：{exc}",
        }
    return {"enabled": True, "status": "ready", "message": "Neo4j schema 已初始化"}


def syncDocumentToNeo4j(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    document_id: str,
) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=workspace_id)
    document = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    ).scalar_one_or_none()
    if document is None:
        return {"enabled": True, "status": "not_found", "message": "文档不存在"}
    chunks = db.execute(
        select(DocumentChunk)
        .where(
            DocumentChunk.workspace_id == workspace_id,
            DocumentChunk.document_id == document_id,
        )
        .order_by(DocumentChunk.chunk_index.asc())
    ).scalars().all()

    initializeNeo4jSchema(settings)
    try:
        _delete_document_file_relations(settings, workspace_id=workspace_id, document_id=document.id)
        document_title = _document_title(document.filename)
        for chunk in chunks:
            syncChunkToNeo4j(
                db,
                settings=settings,
                workspace_id=workspace_id,
                document_id=document.id,
                chunk_id=chunk.id,
                document_title=document_title,
            )
    except Exception as exc:
        logger.warning("Neo4j document sync failed: %s", exc)
        return {"enabled": True, "status": "unavailable", "message": str(exc)}
    return {"enabled": True, "status": "synced", "message": "文档已同步到 Neo4j"}


def syncChunkToNeo4j(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    document_id: str,
    chunk_id: str,
    document_title: str | None = None,
) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=workspace_id)
    chunk = db.execute(
        select(DocumentChunk).where(
            DocumentChunk.id == chunk_id,
            DocumentChunk.workspace_id == workspace_id,
            DocumentChunk.document_id == document_id,
        )
    ).scalar_one_or_none()
    if chunk is None:
        return {"enabled": True, "status": "not_found", "message": "片段不存在"}

    metadata = chunk.metadata_json or {}
    filename = str(metadata.get("filename") or "")
    if not filename:
        filename = (
            db.execute(
                select(Document.filename).where(
                    Document.id == document_id,
                    Document.workspace_id == workspace_id,
                )
            ).scalar_one_or_none()
            or ""
        )
    if document_title is None:
        document_title = _document_title(filename)
    entities = _extract_file_entities(chunk.content, limit=24, document_title=document_title)
    for entity in entities:
        runNeo4jQuery(
            settings,
            """
            MERGE (e:Entity {id: $entity_node_id, workspace_id: $workspace_id})
            WITH e, coalesce(e.raw_score, 0) + $entity_weight AS next_score
            SET e.name = $entity,
                e.canonical_name = $canonical_name,
                e.aliases = $aliases,
                e.entity_type = $entity_type,
                e.semantic_type = $semantic_type,
                e.source = "file",
                e.last_filename = $filename,
                e.last_document_id = $document_id,
                e.document_ids = CASE
                    WHEN e.document_ids IS NULL THEN [$document_id]
                    WHEN NOT $document_id IN e.document_ids THEN e.document_ids + $document_id
                    ELSE e.document_ids
                END,
                e.last_chunk_id = $chunk_id,
                e.last_chunk_index = $chunk_index,
                e.content_preview = $content_preview,
                e.mention_count = coalesce(e.mention_count, 0) + $mentions,
                e.raw_score = next_score,
                e.weight = CASE WHEN next_score > 100 THEN 100 ELSE toInteger(next_score) END,
                e.confidence = CASE WHEN $confidence > coalesce(e.confidence, 0) THEN $confidence ELSE coalesce(e.confidence, 0) END,
                e.updated_at = $updated_at
            """,
            {
                "workspace_id": workspace_id,
                "entity_node_id": _entity_node_id(workspace_id, entity["canonical_name"]),
                "entity": entity["name"],
                "canonical_name": entity["canonical_name"],
                "aliases": entity["aliases"],
                "entity_type": entity["entity_type"],
                "semantic_type": entity["semantic_type"],
                "entity_weight": int(entity.get("weight") or 1),
                "mentions": int(entity.get("mentions") or 1),
                "confidence": int(entity.get("confidence") or 50),
                "filename": filename,
                "document_id": document_id,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "content_preview": _preview(chunk.content, 360),
                "updated_at": _now_iso(),
            },
            write=True,
        )
    for relation in _extract_file_relations(entities, chunk.content, limit=36):
        runNeo4jQuery(
            settings,
            """
            MATCH (source:Entity {id: $source_node_id, workspace_id: $workspace_id})
            MATCH (target:Entity {id: $target_node_id, workspace_id: $workspace_id})
            MERGE (source)-[r:FILE_RELATION {
                workspace_id: $workspace_id,
                source_name: $source_name,
                target_name: $target_name,
                document_id: $document_id,
                chunk_id: $chunk_id
            }]->(target)
            WITH r, coalesce(r.raw_score, 0) + $relation_weight AS next_score
            SET r.label = $relation_label,
                r.relation = $relation_label,
                r.relation_type = $relation_type,
                r.source = "file",
                r.filename = $filename,
                r.chunk_index = $chunk_index,
                r.content_preview = $content_preview,
                r.evidence = $evidence,
                r.raw_score = next_score,
                r.weight = CASE WHEN next_score > 100 THEN 100 ELSE toInteger(next_score) END,
                r.confidence = CASE WHEN $confidence > coalesce(r.confidence, 0) THEN $confidence ELSE coalesce(r.confidence, 0) END,
                r.updated_at = $updated_at
            """,
            {
                "workspace_id": workspace_id,
                "source_node_id": _entity_node_id(workspace_id, relation["source_canonical"]),
                "target_node_id": _entity_node_id(workspace_id, relation["target_canonical"]),
                "source_name": relation["source"],
                "target_name": relation["target"],
                "relation_label": relation["label"],
                "relation_type": relation["relation_type"],
                "relation_weight": int(relation.get("weight") or 1),
                "confidence": int(relation.get("confidence") or 50),
                "evidence": relation.get("evidence") or "",
                "filename": filename,
                "document_id": document_id,
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "content_preview": _preview(chunk.content, 360),
                "updated_at": _now_iso(),
            },
            write=True,
        )
    return {"enabled": True, "status": "synced", "message": "片段已同步到 Neo4j"}


def syncQuestionToNeo4j(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    question_id: str,
    question_text: str,
    asker_id: str,
    model_name: str,
    answer_preview: str,
    sources: list[dict],
) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=workspace_id)
    return {
        "enabled": True,
        "status": "skipped",
        "message": "知识图谱仅展示文件内容实体关系，问答记录不写入 Neo4j 图谱。",
    }


def deleteDocumentFromNeo4j(
    settings: Settings,
    *,
    workspace_id: str,
    document_id: str,
) -> dict:
    if not settings.neo4j_enabled:
        return _disabled_payload(workspace_id=workspace_id)
    try:
        _delete_document_file_relations(settings, workspace_id=workspace_id, document_id=document_id)
    except Exception as exc:
        logger.warning("Neo4j document delete sync failed: %s", exc)
        return {"enabled": True, "status": "unavailable", "message": str(exc)}
    return {"enabled": True, "status": "deleted", "message": "文档图谱节点已删除"}


def getWorkspaceKnowledgeGraph(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
    limit: int = DEFAULT_NODE_LIMIT,
    edge_limit: int = DEFAULT_EDGE_LIMIT,
    node_types: list[str] | None = None,
    document_ids: list[str] | None = None,
) -> dict:
    if not settings.neo4j_enabled:
        return _database_graph_payload(
            db,
            workspace_id=workspace_id,
            limit=limit,
            edge_limit=edge_limit,
            node_types=node_types,
            document_ids=document_ids,
            message="Neo4j 图数据库未启用，已使用当前工作区数据库生成可用知识图谱。",
        )
    safe_limit = min(max(limit, 1), MAX_NODES)
    safe_edge_limit = min(max(edge_limit, 1), DEFAULT_EDGE_LIMIT)
    try:
        initializeNeo4jSchema(settings)
        node_rows = runNeo4jQuery(
            settings,
            """
            MATCH (n:Entity {workspace_id: $workspace_id})
            WHERE size($node_types) = 0 OR "entity" IN $node_types
            WITH n, labels(n) AS node_labels, properties(n) AS props
            WHERE size($document_ids) = 0
               OR props.last_document_id IN $document_ids
               OR any(item IN coalesce(props.document_ids, []) WHERE item IN $document_ids)
            RETURN n.id AS id,
                   node_labels AS labels,
                   props AS properties
            ORDER BY coalesce(toInteger(props.weight), 1) DESC,
                     coalesce(toString(props.updated_at), "") DESC
            LIMIT $limit
            """,
            {
                "workspace_id": workspace_id,
                "node_types": list(_normalize_node_type_filter(node_types)),
                "document_ids": document_ids or [],
                "limit": safe_limit,
            },
        )
        nodes = [_node_from_row(row) for row in node_rows]
        node_ids = [node["id"] for node in nodes]
        edge_rows = []
        if node_ids:
            edge_rows = runNeo4jQuery(
                settings,
                """
                MATCH (a:Entity {workspace_id: $workspace_id})-[r:FILE_RELATION]->(b:Entity {workspace_id: $workspace_id})
                WHERE a.id IN $node_ids AND b.id IN $node_ids
                  AND (size($document_ids) = 0 OR r.document_id IN $document_ids)
                RETURN coalesce(r.id, elementId(r)) AS id,
                       a.id AS source,
                       b.id AS target,
                       coalesce(r.label, type(r)) AS label,
                       properties(r) AS properties
                LIMIT $edge_limit
                """,
                {
                    "workspace_id": workspace_id,
                    "node_ids": node_ids,
                    "document_ids": document_ids or [],
                    "edge_limit": safe_edge_limit,
                },
            )
        edges = [_edge_from_row(row) for row in edge_rows]
    except Exception as exc:
        return _database_graph_payload(
            db,
            workspace_id=workspace_id,
            limit=limit,
            edge_limit=edge_limit,
            node_types=node_types,
            document_ids=document_ids,
            message=f"Neo4j 图数据库暂不可用，已使用数据库回退图谱：{exc}",
        )
    return _graph_payload(
        workspace_id=workspace_id,
        nodes=nodes,
        edges=edges,
        partial=len(nodes) >= safe_limit,
    )


def searchGraphNodes(
    db: Session,
    settings: Settings,
    *,
    workspace_id: str,
    query: str,
    limit: int = 20,
    document_ids: list[str] | None = None,
) -> dict:
    normalized_query = query.strip()
    if not settings.neo4j_enabled:
        return _database_search_nodes(
            db,
            workspace_id=workspace_id,
            query=normalized_query,
            limit=limit,
            document_ids=document_ids,
            message="Neo4j 图数据库未启用，已在数据库回退图谱中搜索。",
        )
    if not normalized_query:
        return {"enabled": True, "status": "ready", "results": []}
    try:
        rows = runNeo4jQuery(
            settings,
            """
            MATCH (n:Entity {workspace_id: $workspace_id})
            WITH n, labels(n) AS node_labels, properties(n) AS props, toLower($query) AS q
            WHERE size($document_ids) = 0
               OR props.last_document_id IN $document_ids
               OR any(item IN coalesce(props.document_ids, []) WHERE item IN $document_ids)
            WITH n, node_labels, props,
                 q,
                 toLower(toString(coalesce(props.canonical_name, ""))) AS canonical_name,
                 toLower(toString(coalesce(props.name, props.entity, ""))) AS entity_name,
                 toLower(toString(coalesce(props.aliases, ""))) AS aliases,
                 toLower(toString(coalesce(props.entity_type, ""))) AS entity_type,
                 toLower(toString(coalesce(props.semantic_type, ""))) AS semantic_type,
                 toLower(toString(coalesce(props.last_filename, props.filename, ""))) AS filename,
                 toLower(toString(coalesce(props.content_preview, props.evidence, ""))) AS preview,
                 toLower(toString(coalesce(props.id, n.id, ""))) AS node_id
            WITH n, node_labels, props,
                 CASE
                   WHEN canonical_name = q THEN 1000
                   WHEN entity_name = q THEN 980
                   WHEN aliases CONTAINS q THEN 940
                   WHEN canonical_name STARTS WITH q THEN 850
                   WHEN entity_name STARTS WITH q THEN 830
                   WHEN canonical_name CONTAINS q THEN 760
                   WHEN entity_name CONTAINS q THEN 740
                   WHEN entity_type = q OR semantic_type = q THEN 680
                   WHEN filename CONTAINS q THEN 560
                   WHEN preview CONTAINS q THEN 420
                   WHEN node_id CONTAINS q THEN 260
                   ELSE 0
                 END AS match_score,
                 CASE
                   WHEN canonical_name = q OR canonical_name STARTS WITH q OR canonical_name CONTAINS q THEN "canonical_name"
                   WHEN entity_name = q OR entity_name STARTS WITH q OR entity_name CONTAINS q THEN "name"
                   WHEN aliases CONTAINS q THEN "aliases"
                   WHEN entity_type = q OR semantic_type = q THEN "entity_type"
                   WHEN filename CONTAINS q THEN "last_filename"
                   WHEN preview CONTAINS q THEN "content_preview"
                   WHEN node_id CONTAINS q THEN "id"
                   ELSE ""
                 END AS match_field
            WHERE match_score > 0
            RETURN n.id AS id,
                   node_labels AS labels,
                   props + {match_score: match_score, match_field: match_field, match_query: $query} AS properties
            ORDER BY match_score DESC,
                     coalesce(toInteger(props.weight), 1) DESC,
                     coalesce(toString(props.updated_at), "") DESC
            LIMIT $limit
            """,
            {
                "workspace_id": workspace_id,
                "query": normalized_query,
                "document_ids": document_ids or [],
                "limit": min(max(limit, 1), 50),
            },
        )
    except Exception as exc:
        return _database_search_nodes(
            db,
            workspace_id=workspace_id,
            query=normalized_query,
            limit=limit,
            document_ids=document_ids,
            message=f"Neo4j 图数据库暂不可用，已在数据库回退图谱中搜索：{exc}",
        )
    return {
        "enabled": True,
        "status": "ready",
        "results": _rank_graph_search_results(
            [_node_from_row(row) for row in rows],
            normalized_query,
            limit=limit,
        ),
    }


def getNodeDetail(db: Session, settings: Settings, *, workspace_id: str, node_id: str) -> dict:
    if not settings.neo4j_enabled:
        return _database_node_detail(db, workspace_id=workspace_id, node_id=node_id)
    try:
        rows = runNeo4jQuery(
            settings,
            """
            MATCH (n:Entity {workspace_id: $workspace_id, id: $node_id})
            WITH n, labels(n) AS node_labels, properties(n) AS props
            RETURN n.id AS id,
                   node_labels AS labels,
                   props AS properties
            LIMIT 1
            """,
            {"workspace_id": workspace_id, "node_id": node_id},
        )
    except Exception as exc:
        return _database_node_detail(
            db,
            workspace_id=workspace_id,
            node_id=node_id,
            message=f"Neo4j 图数据库暂不可用，已读取数据库回退图谱节点：{exc}",
        )
    if not rows:
        return {"enabled": True, "status": "not_found", "message": "节点不存在"}
    return {"enabled": True, "status": "ready", "node": _node_from_row(rows[0])}


def getRelatedNodes(
    db: Session,
    settings: Settings,
    *,
    workspace_id: str,
    node_id: str,
    depth: int = 1,
    limit: int = 40,
) -> dict:
    if not settings.neo4j_enabled:
        return _database_related_nodes(
            db,
            workspace_id=workspace_id,
            node_id=node_id,
            depth=depth,
            limit=limit,
        )
    safe_depth = min(max(depth, 1), 3)
    safe_limit = min(max(limit, 1), 100)
    try:
        rows = runNeo4jQuery(
            settings,
            f"""
            MATCH (n:Entity {{workspace_id: $workspace_id, id: $node_id}})-[r:FILE_RELATION*1..{safe_depth}]-(m:Entity {{workspace_id: $workspace_id}})
            WITH DISTINCT m, labels(m) AS node_labels, properties(m) AS props
            RETURN m.id AS id,
                   node_labels AS labels,
                   props AS properties
            LIMIT $limit
            """,
            {"workspace_id": workspace_id, "node_id": node_id, "limit": safe_limit},
        )
    except Exception as exc:
        return _database_related_nodes(
            db,
            workspace_id=workspace_id,
            node_id=node_id,
            depth=depth,
            limit=limit,
            message=f"Neo4j 图数据库暂不可用，已读取数据库回退图谱邻居：{exc}",
        )
    return {"enabled": True, "status": "ready", "results": [_node_from_row(row) for row in rows]}


def rebuildWorkspaceKnowledgeGraph(
    db: Session,
    *,
    settings: Settings,
    workspace_id: str,
) -> dict:
    if not settings.neo4j_enabled:
        return _database_graph_payload(
            db,
            workspace_id=workspace_id,
            message="Neo4j 图数据库未启用；已刷新当前工作区数据库回退图谱。",
        )
    try:
        initializeNeo4jSchema(settings)
        runNeo4jQuery(
            settings,
            "MATCH (n {workspace_id: $workspace_id}) DETACH DELETE n",
            {"workspace_id": workspace_id},
            write=True,
        )
        documents = db.execute(
            select(Document).where(Document.workspace_id == workspace_id)
        ).scalars().all()
        for document in documents:
            syncDocumentToNeo4j(
                db,
                settings=settings,
                workspace_id=workspace_id,
                document_id=document.id,
            )
    except Exception as exc:
        return _database_graph_payload(
            db,
            workspace_id=workspace_id,
            message=f"Neo4j 图谱重建失败，已返回数据库回退图谱：{exc}",
        )
    return getWorkspaceKnowledgeGraph(db, settings=settings, workspace_id=workspace_id)


def _database_graph_payload(
    db: Session,
    *,
    workspace_id: str,
    limit: int = DEFAULT_NODE_LIMIT,
    edge_limit: int = DEFAULT_EDGE_LIMIT,
    node_types: list[str] | None = None,
    document_ids: list[str] | None = None,
    message: str | None = None,
) -> dict:
    nodes, edges, partial = _build_database_graph(
        db,
        workspace_id=workspace_id,
        limit=limit,
        edge_limit=edge_limit,
        node_types=node_types,
        document_ids=document_ids,
    )
    default_message = (
        "当前工作区数据库暂无可展示的知识图谱节点，请先上传并解析文档。"
        if not nodes
        else "已基于当前工作区文件正文中的实体和关系生成知识图谱。"
    )
    return {
        "enabled": True,
        "status": "ready" if nodes else "empty",
        "message": message or default_message,
        "mode": "database",
        "partial": partial,
        "stats": {
            "workspace_id": workspace_id,
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
        "links": edges,
    }


def _database_search_nodes(
    db: Session,
    *,
    workspace_id: str,
    query: str,
    limit: int = 20,
    document_ids: list[str] | None = None,
    message: str | None = None,
) -> dict:
    nodes, _edges, _partial = _build_database_graph(
        db,
        workspace_id=workspace_id,
        limit=MAX_NODES,
        edge_limit=DEFAULT_EDGE_LIMIT,
        document_ids=document_ids,
    )
    normalized = query.strip().lower()
    safe_limit = min(max(limit, 1), 50)
    if normalized:
        results = _rank_graph_search_results(nodes, query, limit=safe_limit)
    else:
        results = sorted(nodes, key=lambda node: (-int(node.get("weight") or 1), str(node.get("label") or "")))[:safe_limit]
    return {
        "enabled": True,
        "status": "ready",
        "message": message,
        "mode": "database",
        "results": results,
    }


def _rank_graph_search_results(nodes: list[dict], query: str, limit: int = 20) -> list[dict]:
    normalized_query = query.strip().lower()
    safe_limit = min(max(limit, 1), 50)
    if not normalized_query:
        return sorted(nodes, key=lambda node: (-int(node.get("weight") or 1), str(node.get("label") or "")))[:safe_limit]

    ranked: list[dict] = []
    for node in nodes:
        score, field = _graph_search_score(node, normalized_query)
        if score <= 0:
            continue
        enriched = dict(node)
        properties = dict(enriched.get("properties") or {})
        properties["match_score"] = score
        properties["match_field"] = field
        properties["match_query"] = query.strip()
        enriched["properties"] = _json_safe_properties(properties)
        ranked.append(enriched)

    ranked.sort(
        key=lambda node: (
            -int((node.get("properties") or {}).get("match_score") or 0),
            -int(node.get("weight") or 1),
            str(node.get("label") or ""),
        )
    )
    return ranked[:safe_limit]


def _graph_search_score(node: dict, normalized_query: str) -> tuple[int, str]:
    properties = dict(node.get("properties") or {})
    node_weight = min(max(int(node.get("weight") or properties.get("weight") or 1), 1), 100)

    field_groups = [
        ("canonical_name", _string_values(properties.get("canonical_name")), 1000, 850, 760),
        ("name", _string_values(properties.get("name"), properties.get("entity"), node.get("label")), 980, 830, 740),
        ("aliases", _alias_values(properties.get("aliases")), 940, 800, 700),
        ("entity_type", _string_values(properties.get("entity_type"), properties.get("semantic_type")), 680, 620, 560),
        ("last_filename", _string_values(properties.get("last_filename"), properties.get("filename")), 560, 520, 480),
        ("content_preview", _string_values(properties.get("content_preview"), properties.get("evidence")), 420, 380, 340),
        ("id", _string_values(node.get("id"), properties.get("id")), 260, 230, 200),
    ]

    best_score = 0
    best_field = ""
    for field, values, exact_score, prefix_score, contains_score in field_groups:
        for value in values:
            normalized_value = value.strip().lower()
            if not normalized_value:
                continue
            if normalized_value == normalized_query:
                score = exact_score + node_weight
            elif normalized_value.startswith(normalized_query):
                score = prefix_score + min(node_weight, 80)
            elif normalized_query in normalized_value:
                score = contains_score + min(node_weight, 60)
            else:
                continue
            if score > best_score:
                best_score = score
                best_field = field
    return best_score, best_field


def _string_values(*values: Any) -> list[str]:
    result: list[str] = []
    for value in values:
        if value is None:
            continue
        if isinstance(value, list):
            result.extend(str(item) for item in value if item is not None)
        else:
            result.append(str(value))
    return result


def _alias_values(value: Any) -> list[str]:
    values: list[str] = []
    for item in _string_values(value):
        values.extend(part.strip() for part in re.split(r"[,，;；、|/]+", item) if part.strip())
        values.append(item)
    return values


def _database_node_detail(
    db: Session,
    *,
    workspace_id: str,
    node_id: str,
    message: str | None = None,
) -> dict:
    nodes, _edges, _partial = _build_database_graph(
        db,
        workspace_id=workspace_id,
        limit=MAX_NODES,
        edge_limit=DEFAULT_EDGE_LIMIT,
        document_ids=None,
    )
    node = next((item for item in nodes if item["id"] == node_id), None)
    if node is None:
        return {
            "enabled": True,
            "status": "not_found",
            "mode": "database",
            "message": "节点不存在或不属于当前工作区。",
        }
    return {
        "enabled": True,
        "status": "ready",
        "mode": "database",
        "message": message,
        "node": node,
    }


def _database_related_nodes(
    db: Session,
    *,
    workspace_id: str,
    node_id: str,
    depth: int = 1,
    limit: int = 40,
    message: str | None = None,
) -> dict:
    nodes, edges, _partial = _build_database_graph(
        db,
        workspace_id=workspace_id,
        limit=MAX_NODES,
        edge_limit=DEFAULT_EDGE_LIMIT,
        document_ids=None,
    )
    node_by_id = {node["id"]: node for node in nodes}
    if node_id not in node_by_id:
        return {
            "enabled": True,
            "status": "not_found",
            "mode": "database",
            "message": "节点不存在或不属于当前工作区。",
            "results": [],
        }
    adjacency: dict[str, set[str]] = {}
    for edge in edges:
        adjacency.setdefault(edge["source"], set()).add(edge["target"])
        adjacency.setdefault(edge["target"], set()).add(edge["source"])
    safe_depth = min(max(depth, 1), 3)
    safe_limit = min(max(limit, 1), 100)
    visited = {node_id}
    frontier = {node_id}
    related: list[dict] = []
    for _level in range(safe_depth):
        next_frontier: set[str] = set()
        for current in frontier:
            for neighbor_id in sorted(adjacency.get(current, set())):
                if neighbor_id in visited:
                    continue
                visited.add(neighbor_id)
                next_frontier.add(neighbor_id)
                related.append(node_by_id[neighbor_id])
                if len(related) >= safe_limit:
                    return {
                        "enabled": True,
                        "status": "ready",
                        "mode": "database",
                        "message": message,
                        "results": related,
                    }
        frontier = next_frontier
        if not frontier:
            break
    return {
        "enabled": True,
        "status": "ready",
        "mode": "database",
        "message": message,
        "results": related,
    }


def _build_database_graph(
    db: Session,
    *,
    workspace_id: str,
    limit: int,
    edge_limit: int,
    node_types: list[str] | None = None,
    document_ids: list[str] | None = None,
) -> tuple[list[dict], list[dict], bool]:
    safe_limit = min(max(limit, 1), MAX_NODES)
    safe_edge_limit = min(max(edge_limit, 1), DEFAULT_EDGE_LIMIT)
    type_filter = _normalize_node_type_filter(node_types)

    node_map: dict[str, dict] = {}
    edge_map: dict[str, dict] = {}

    def add_node(node: dict) -> None:
        node_id = str(node.get("id") or "")
        if not node_id or node_id in node_map:
            return
        node_map[node_id] = node

    def add_edge(edge: dict) -> None:
        edge_id = str(edge.get("id") or "")
        if not edge_id or edge_id in edge_map:
            return
        edge_map[edge_id] = edge

    document_filters = [Document.workspace_id == workspace_id]
    if document_ids:
        document_filters.append(Document.id.in_(document_ids))
    documents = db.execute(
        select(Document)
        .where(*document_filters)
        .order_by(Document.updated_at.desc(), Document.created_at.desc())
    ).scalars().all()
    document_by_id = {document.id: document for document in documents}

    chunk_filters = [DocumentChunk.workspace_id == workspace_id]
    if document_ids:
        chunk_filters.append(DocumentChunk.document_id.in_(document_ids))
    chunks = db.execute(
        select(DocumentChunk)
        .where(*chunk_filters)
        .order_by(DocumentChunk.document_id.asc(), DocumentChunk.chunk_index.asc())
    ).scalars().all()

    for chunk in chunks:
        document = document_by_id.get(chunk.document_id)
        filename = document.filename if document else str((chunk.metadata_json or {}).get("filename") or "")
        document_title = _document_title(filename)
        entities = _extract_file_entities(chunk.content, limit=24, document_title=document_title)
        for entity in entities:
            entity_node_id = _entity_node_id(workspace_id, entity["canonical_name"])
            entity_weight = int(entity.get("weight") or 1)
            existing = node_map.get(entity_node_id)
            if existing:
                existing["weight"] = min(100, int(existing.get("weight") or 1) + entity_weight)
                existing["properties"]["weight"] = existing["weight"]
                existing["properties"]["mention_count"] = int(existing["properties"].get("mention_count") or 0) + int(entity.get("mentions") or 1)
                existing["properties"]["last_filename"] = filename
                existing["properties"]["last_document_id"] = chunk.document_id
                existing["properties"]["last_chunk_id"] = chunk.id
                existing["properties"]["last_chunk_index"] = chunk.chunk_index
                continue
            add_node(
                _database_node(
                    entity_node_id,
                    entity["name"],
                    ENTITY_NODE_TYPE,
                    weight=entity_weight,
                    properties={
                        "workspace_id": workspace_id,
                        "entity": entity["name"],
                        "canonical_name": entity["canonical_name"],
                        "aliases": ", ".join(entity["aliases"]),
                        "entity_type": entity["entity_type"],
                        "semantic_type": entity["semantic_type"],
                        "source": "file",
                        "weight": entity_weight,
                        "mention_count": int(entity.get("mentions") or 1),
                        "confidence": int(entity.get("confidence") or 50),
                        "last_filename": filename,
                        "last_document_id": chunk.document_id,
                        "last_chunk_id": chunk.id,
                        "last_chunk_index": chunk.chunk_index,
                        "content_preview": _preview(chunk.content, 360),
                    },
                )
            )
        for relation in _extract_file_relations(entities, chunk.content, limit=16):
            add_edge(
                _database_edge(
                    _entity_node_id(workspace_id, relation["source_canonical"]),
                    _entity_node_id(workspace_id, relation["target_canonical"]),
                    relation["label"],
                    weight=int(relation.get("weight") or 1),
                    properties={
                        "workspace_id": workspace_id,
                        "source": "file",
                        "source_name": relation["source"],
                        "target_name": relation["target"],
                        "relation_type": relation["relation_type"],
                        "confidence": int(relation.get("confidence") or 50),
                        "evidence": relation.get("evidence") or "",
                        "document_id": chunk.document_id,
                        "filename": filename,
                        "chunk_id": chunk.id,
                        "chunk_index": chunk.chunk_index,
                        "content_preview": _preview(chunk.content, 360),
                    },
                )
            )

    candidate_nodes = list(node_map.values())
    if type_filter:
        candidate_nodes = [
            node for node in candidate_nodes if node["type"].lower() in type_filter
        ]
    partial = len(candidate_nodes) > safe_limit
    visible_nodes = candidate_nodes[:safe_limit]
    visible_ids = {node["id"] for node in visible_nodes}
    visible_edges = [
        edge
        for edge in edge_map.values()
        if edge["source"] in visible_ids and edge["target"] in visible_ids
    ][:safe_edge_limit]
    return visible_nodes, visible_edges, partial or len(visible_edges) < len(edge_map)


def _database_node(
    node_id: str,
    label: str,
    node_type: str,
    *,
    weight: int = 1,
    properties: dict | None = None,
) -> dict:
    return {
        "id": node_id,
        "label": _preview(label or node_id, 80),
        "type": node_type,
        "weight": max(int(weight or 1), 1),
        "properties": _json_safe_properties(properties or {}),
    }


def _database_edge(
    source: str,
    target: str,
    label: str,
    *,
    weight: int = 1,
    properties: dict | None = None,
) -> dict:
    return {
        "id": f"{source}->{target}:{label}",
        "source": source,
        "target": target,
        "label": label,
        "weight": max(int(weight or 1), 1),
        "properties": _json_safe_properties(properties or {}),
    }


def _normalize_node_type_filter(node_types: list[str] | None) -> set[str]:
    if not node_types:
        return set()
    aliases = {
        "entity": "entity",
        "entities": "entity",
        "keyword": "keyword",
        "concept": "concept",
    }
    normalized: set[str] = set()
    for node_type in node_types:
        key = node_type.strip().lower()
        if not key:
            continue
        normalized.add(aliases.get(key, key))
    return normalized


def _graph_payload(
    *,
    workspace_id: str,
    nodes: list[dict],
    edges: list[dict],
    partial: bool = False,
) -> dict:
    return {
        "enabled": True,
        "status": "ready" if nodes else "empty",
        "message": None if nodes else "当前工作区 Neo4j 图谱暂无可展示节点。",
        "mode": "neo4j",
        "partial": partial,
        "stats": {
            "workspace_id": workspace_id,
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
        "links": edges,
    }


def _disabled_payload(workspace_id: str | None) -> dict:
    return {
        "enabled": False,
        "status": "disabled",
        "message": "Neo4j 图数据库暂未启用，当前无法展示真实知识图谱。",
        "mode": "neo4j",
        "partial": False,
        "stats": {
            "workspace_id": workspace_id,
            "node_count": 0,
            "edge_count": 0,
        },
        "nodes": [],
        "edges": [],
        "links": [],
    }


def _unavailable_payload(*, workspace_id: str, message: str) -> dict:
    return {
        "enabled": True,
        "status": "unavailable",
        "message": f"Neo4j 图数据库暂不可用：{message}",
        "mode": "neo4j",
        "partial": False,
        "stats": {
            "workspace_id": workspace_id,
            "node_count": 0,
            "edge_count": 0,
        },
        "nodes": [],
        "edges": [],
        "links": [],
    }


def _node_from_row(row: dict) -> dict:
    labels = row.get("labels") or []
    node_type = _preferred_label(labels)
    properties = dict(row.get("properties") or {})
    label = row.get("label")
    if not label:
        label = (
            properties.get("name")
            or properties.get("entity")
            or properties.get("last_filename")
            or properties.get("content_preview")
            or properties.get("id")
            or row.get("id")
            or ""
        )
    return {
        "id": str(row.get("id") or properties.get("id") or ""),
        "label": _preview(str(label or ""), 80),
        "type": node_type,
        "weight": int(properties.get("weight") or properties.get("chunk_count") or 1),
        "properties": _json_safe_properties(properties),
    }


def _edge_from_row(row: dict) -> dict:
    properties = dict(row.get("properties") or {})
    source = str(row.get("source") or "")
    target = str(row.get("target") or "")
    label = str(row.get("label") or "RELATED_TO")
    return {
        "id": str(row.get("id") or f"{source}->{target}:{label}"),
        "source": source,
        "target": target,
        "label": label,
        "weight": int(properties.get("weight") or 1),
        "properties": _json_safe_properties(properties),
    }


def _preferred_label(labels: list[str]) -> str:
    for label in ("Entity", "Concept", "Keyword"):
        if label in labels:
            return ENTITY_NODE_TYPE if label == "Entity" else label.lower()
    return labels[0].lower() if labels else "node"


def _json_safe_properties(properties: dict) -> dict:
    safe = {}
    for key, value in properties.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[key] = value
        elif isinstance(value, list):
            safe[key] = ", ".join(str(item) for item in value if isinstance(item, (str, int, float, bool)))
    return safe


_ENTITY_STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "workspace",
    "document",
    "chunk",
    "question",
    "answer",
    "当前",
    "当前工作区",
    "工作区",
    "文档",
    "片段",
    "问答",
    "问题",
    "回答",
    "用户",
    "系统",
    "数据",
    "内容",
    "文件",
    "可以",
    "需要",
    "通过",
    "进行",
    "一个",
    "这个",
    "以及",
    "如果",
    "没有",
    "当前用户",
    "结果",
    "来源",
    "详情",
    "操作",
    "名称",
    "说明",
    "时间",
    "数量",
    "状态",
    "类型",
    "默认",
    "全部",
    "相关",
    "主要",
    "workspace_id",
    "document_id",
    "user_id",
    "tenant_id",
    "api",
    "contains",
    "contain",
    "includes",
    "include",
    "depends",
    "calls",
    "call",
    "uses",
    "use",
    "references",
    "reference",
    "stores",
    "store",
    "writes",
    "write",
    "isolates",
    "isolate",
    "protects",
    "protect",
    "belongs",
    "derived",
    "storage",
    "results",
    "retrieval",
}

_TECH_ENTITY_PATTERN = re.compile(
    r"\b(?:Neo4j|Milvus|MinIO|Redis|MySQL|PostgreSQL|RAG|API|DeepSeek|Ollama|"
    r"FAISS|Chroma|FastAPI|React|Vite|Docker|Nginx|JWT|SMTP|LLM|HTTP|HTTPS|"
    r"WebSocket|SSE|JSON|CSV|PDF|Word|Excel|Markdown|GitHub|Node|Python|Uvicorn)\b",
    re.IGNORECASE,
)

_CHINESE_ENTITY_PATTERN = re.compile(
    r"[\u4e00-\u9fffA-Za-z0-9_-]{2,24}"
    r"(?:平台|系统|模块|服务|模型|数据库|知识库|工作台|接口|权限|角色|流程|策略|配置|状态|"
    r"日志|实体|关系|图谱|索引|检索|上传|解析|入库|切片|审计|隔离|安全|搜索|缓存|"
    r"文档|文件|知识片段|向量库|重排|问答|驾驶舱|工作区|成员|通知|任务|队列)"
)

_API_ENTITY_PATTERN = re.compile(
    r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+/[A-Za-z0-9_./{}:-]+|/api/[A-Za-z0-9_./{}:-]+",
    re.IGNORECASE,
)

_FILE_ENTITY_PATTERN = re.compile(
    r"[\u4e00-\u9fffA-Za-z0-9_（）()《》【】\-\s]{1,80}"
    r"\.(?:docx?|pdf|xlsx?|pptx?|txt|md|csv|json|ya?ml|py|ts|tsx|js|java|go)",
    re.IGNORECASE,
)

_CONFIG_ENTITY_PATTERN = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")

_ENTITY_TYPE_LABELS = {
    "file": "文件实体",
    "api": "API实体",
    "technology": "技术实体",
    "knowledge_base": "知识库实体",
    "workspace": "工作区实体",
    "module": "模块实体",
    "process": "流程实体",
    "config": "配置实体",
    "permission": "权限实体",
    "concept": "概念实体",
}

_ENTITY_TYPE_PRIORITY = {
    "api": 100,
    "file": 95,
    "technology": 90,
    "knowledge_base": 82,
    "workspace": 80,
    "config": 72,
    "permission": 70,
    "module": 64,
    "process": 58,
    "concept": 40,
}

_RELATION_SUBJECT_OBJECT_HINTS = [
    ("derived from", "派生自", "结构关系"),
    ("belongs to", "属于", "归属关系"),
    ("depends on", "依赖", "依赖关系"),
    ("references", "引用", "引用关系"),
    ("reference", "引用", "引用关系"),
    ("contains", "包含", "组成关系"),
    ("contain", "包含", "组成关系"),
    ("includes", "包含", "组成关系"),
    ("include", "包含", "组成关系"),
    ("depends", "依赖", "依赖关系"),
    ("calls", "调用", "调用关系"),
    ("call", "调用", "调用关系"),
    ("uses", "使用", "使用关系"),
    ("use", "使用", "使用关系"),
    ("stores", "写入", "数据写入"),
    ("store", "写入", "数据写入"),
    ("writes", "写入", "数据写入"),
    ("write", "写入", "数据写入"),
    ("isolates", "隔离", "安全关系"),
    ("isolate", "隔离", "安全关系"),
    ("protects", "保护", "安全关系"),
    ("protect", "保护", "安全关系"),
    ("派生自", "派生自", "结构关系"),
    ("来源于", "来源于", "来源关系"),
    ("引用", "引用", "引用关系"),
    ("依赖", "依赖", "依赖关系"),
    ("属于", "属于", "归属关系"),
    ("包含", "包含", "组成关系"),
    ("包括", "包含", "组成关系"),
    ("涵盖", "包含", "组成关系"),
    ("组成", "组成", "组成关系"),
    ("关联", "关联", "语义关联"),
    ("连接", "连接", "连接关系"),
    ("负责", "负责", "职责关系"),
    ("管理", "管理", "管理关系"),
    ("使用", "使用", "使用关系"),
    ("调用", "调用", "调用关系"),
    ("支持", "支持", "支持关系"),
    ("生成", "生成", "生成关系"),
    ("同步", "同步", "同步关系"),
    ("隔离", "隔离", "安全关系"),
    ("保护", "保护", "安全关系"),
    ("写入", "写入", "数据写入"),
    ("检索", "检索", "检索关系"),
    ("上传", "上传", "流程关系"),
    ("解析", "解析", "流程关系"),
    ("入库", "入库", "流程关系"),
    ("记录", "记录", "记录关系"),
    ("提供", "提供", "能力关系"),
    ("应用于", "应用于", "应用关系"),
    ("depends", "依赖", "依赖关系"),
    ("contain", "包含", "组成关系"),
    ("connect", "连接", "连接关系"),
]

_RELATION_HINT_PATTERN = re.compile(
    "|".join(
        re.escape(item[0])
        for item in sorted(_RELATION_SUBJECT_OBJECT_HINTS, key=lambda item: -len(item[0]))
    ),
    re.IGNORECASE,
)

_RELATION_VERBS = tuple(item[0] for item in _RELATION_SUBJECT_OBJECT_HINTS)

_GENERIC_ENTITY_NAMES = {
    "系统",
    "平台",
    "模块",
    "服务",
    "流程",
    "策略",
    "页面",
    "功能",
    "字段",
    "数据",
    "内容",
    "文档",
    "文件",
    "片段",
    "关系",
    "实体",
    "知识库",
    "图谱",
    "节点",
    "按钮",
    "用户",
    "公司",
    "领域",
    "行业",
}

_NOISY_ENTITY_PREFIXES = (
    "包括",
    "包含",
    "并通过",
    "通过",
    "经过",
    "如果",
    "还将",
    "同时",
    "用于",
    "进行",
    "实现",
    "支持",
    "提供",
    "根据",
    "当前",
)

_NOISY_ENTITY_FRAGMENTS = (
    "能力集成",
    "候选片段",
    "参数方案",
    "结果推送",
    "等结构",
    "等节点",
    "等节",
    "可用于",
    "用于检索",
    "进行问答",
    "结合大模型",
    "返回引用来源",
    "进入市场",
    "行业/领域",
)

_RELATION_NOUN_SUFFIXES = (
    "系统",
    "平台",
    "模块",
    "服务",
    "流程",
    "策略",
    "页面",
    "功能",
    "字段",
    "数据",
    "中心",
    "工具",
    "模型",
    "接口",
    "数据库",
    "知识库",
    "工作区",
    "驾驶舱",
)

_ENTITY_CANONICAL_ALIASES = {
    "rag": "RAG",
    "rag问答": "RAG",
    "检索增强生成": "RAG",
    "知识库问答": "RAG",
    "neo4j图数据库": "Neo4j",
    "图数据库": "Neo4j",
    "milvus向量库": "Milvus",
    "向量数据库": "Milvus",
    "milvus向量数据库": "Milvus",
    "对象存储": "MinIO",
    "minio对象存储": "MinIO",
    "对象存储服务": "MinIO",
    "postgres": "PostgreSQL",
    "pgsql": "PostgreSQL",
    "mysql数据库": "MySQL",
    "redis缓存": "Redis",
    "大模型": "LLM",
    "语言模型": "LLM",
    "neo4j": "Neo4j",
    "neo4j知识图谱": "Neo4j",
    "milvus": "Milvus",
    "milvus向量数据库": "Milvus",
    "向量库": "Milvus",
    "工作空间": "工作区",
    "个人空间": "个人工作区",
    "企业空间": "企业工作区",
    "个人知识空间": "个人工作区",
    "企业知识空间": "企业工作区",
    "知识片段": "知识片段",
    "片段": "知识片段",
    "索引": "向量索引",
    "向量检索": "向量检索",
}

def _delete_document_file_relations(
    settings: Settings,
    *,
    workspace_id: str,
    document_id: str,
) -> None:
    runNeo4jQuery(
        settings,
        """
        MATCH (:Entity {workspace_id: $workspace_id})
              -[r:FILE_RELATION {workspace_id: $workspace_id, document_id: $document_id}]-
              (:Entity {workspace_id: $workspace_id})
        DELETE r
        """,
        {"workspace_id": workspace_id, "document_id": document_id},
        write=True,
    )
    runNeo4jQuery(
        settings,
        """
        MATCH (e:Entity {workspace_id: $workspace_id})
        WHERE $document_id IN coalesce(e.document_ids, [])
           OR e.last_document_id = $document_id
        SET e.document_ids = [item IN coalesce(e.document_ids, []) WHERE item <> $document_id]
        WITH e
        OPTIONAL MATCH (e)-[r:FILE_RELATION {workspace_id: $workspace_id}]-()
        WITH e, count(r) AS relation_count, size(coalesce(e.document_ids, [])) AS document_count
        WHERE relation_count = 0 AND document_count = 0
        DETACH DELETE e
        """,
        {"workspace_id": workspace_id, "document_id": document_id},
        write=True,
    )


def _extract_file_entities(
    content: str,
    limit: int = 24,
    *,
    document_title: str | None = None,
) -> list[dict]:
    cleaned = re.sub(r"\s+", " ", content or "").strip()
    if not cleaned and not document_title:
        return []

    scored: dict[str, dict] = {}

    def add(raw_token: str, position: int, source: str, boost: int) -> None:
        token = _clean_entity_token(raw_token)
        if not _is_valid_entity(token):
            return
        canonical = _canonical_entity_name(token)
        key = _entity_key(canonical)
        entity_type = _entity_type(canonical)
        item = scored.setdefault(
            key,
            {
                "name": canonical,
                "canonical_name": canonical,
                "aliases": set(),
                "entity_type": entity_type,
                "semantic_type": _semantic_type(canonical, source),
                "mentions": 0,
                "raw_score": 0,
                "first_position": position,
                "sources": set(),
            },
        )
        if _ENTITY_TYPE_PRIORITY.get(entity_type, 0) > _ENTITY_TYPE_PRIORITY.get(str(item["entity_type"]), 0):
            item["entity_type"] = entity_type
            item["semantic_type"] = _semantic_type(canonical, source)
        item["aliases"].add(token)
        item["mentions"] = int(item["mentions"]) + 1
        item["raw_score"] = int(item["raw_score"]) + boost
        item["first_position"] = min(int(item["first_position"]), position)
        item["sources"].add(source)

    if document_title:
        add(document_title, 0, "title", 34)

    lines = [line.strip() for line in (content or "").splitlines() if line.strip()]
    cursor = 0
    for line_index, line in enumerate(lines[:120]):
        line_position = cursor
        cursor += len(line) + 1
        line_boost = 4
        source = "body"
        if _looks_like_heading(line):
            source = "heading"
            line_boost = 26
            add(line, line_position, source, line_boost)
        elif line_index < 4:
            source = "lead"
            line_boost = 18
        elif _looks_like_table_line(line):
            source = "table"
            line_boost = 20
        elif _looks_like_code_line(line):
            source = "code"
            line_boost = 20

        for token, offset, token_boost in _candidate_tokens(line):
            add(token, line_position + offset, source, line_boost + token_boost)

        first_sentence = re.split(r"[。.!?！？；;]", line, maxsplit=1)[0]
        if first_sentence and first_sentence != line:
            for token, offset, token_boost in _candidate_tokens(first_sentence):
                add(token, line_position + offset, "lead_sentence", 12 + token_boost)

    if not scored:
        for match in re.finditer(r"[\u4e00-\u9fff]{2,10}", cleaned):
            add(match.group(0), match.start(), "fallback", 3)

    entities: list[dict] = []
    for item in scored.values():
        raw_score = int(item["raw_score"])
        mentions = int(item["mentions"])
        entity_type = str(item["entity_type"])
        relation_ready_bonus = 8 if mentions > 1 else 0
        source_bonus = _source_importance_bonus(item["sources"])
        type_bonus = max(0, (_ENTITY_TYPE_PRIORITY.get(entity_type, 40) - 40) // 2)
        weight = min(100, max(10, raw_score + source_bonus + type_bonus + min(mentions * 3, 24) + relation_ready_bonus))
        confidence = min(98, 45 + min(raw_score, 38) + min(source_bonus, 18) + min(mentions * 4, 20))
        entities.append(
            {
                "name": item["name"],
                "canonical_name": item["canonical_name"],
                "aliases": sorted(str(alias) for alias in item["aliases"]),
                "entity_type": item["entity_type"],
                "semantic_type": item["semantic_type"],
                "mentions": mentions,
                "weight": weight,
                "confidence": confidence,
                "first_position": int(item["first_position"]),
            }
        )

    entities.sort(
        key=lambda item: (
            -int(item["weight"]),
            -int(item["mentions"]),
            int(item["first_position"]),
            str(item["name"]),
        )
    )
    return entities[: max(limit, 1)]


def _extract_file_relations(entities: list[dict], content: str, limit: int = 36) -> list[dict]:
    if len(entities) < 2:
        return []

    entity_lookup = []
    for entity in entities:
        aliases = {str(entity["name"]), str(entity["canonical_name"]), *[str(item) for item in entity.get("aliases", [])]}
        entity_lookup.append((entity, sorted(aliases, key=len, reverse=True)))

    relations: dict[str, dict] = {}

    def add_relation(source: dict, target: dict, label: str, relation_type: str, evidence: str, base_weight: int) -> None:
        if source["canonical_name"] == target["canonical_name"]:
            return
        key = f"{source['canonical_name']}->{target['canonical_name']}:{label}"
        confidence = min(98, 45 + base_weight + min(int(source.get("mentions") or 1) + int(target.get("mentions") or 1), 16))
        next_weight = min(100, max(30, base_weight + int(source.get("weight") or 1) // 8 + int(target.get("weight") or 1) // 8))
        existing = relations.get(key)
        if existing:
            existing["weight"] = min(100, int(existing["weight"]) + max(4, next_weight // 4))
            existing["confidence"] = max(int(existing["confidence"]), confidence)
            if len(str(existing.get("evidence") or "")) < len(evidence):
                existing["evidence"] = evidence
            return
        relations[key] = {
            "source": source["name"],
            "source_canonical": source["canonical_name"],
            "target": target["name"],
            "target_canonical": target["canonical_name"],
            "label": label,
            "relation_type": relation_type,
            "weight": next_weight,
            "confidence": confidence,
            "evidence": _preview(evidence, 180),
        }

    for source, target, label, relation_type, base_weight, evidence in _structured_relation_pairs(content, entity_lookup):
        add_relation(source, target, label, relation_type, evidence, base_weight)

    for sentence in _split_relation_sentences(content):
        positioned = _entity_positions_in_text(sentence, entity_lookup)
        if len(positioned) < 2:
            continue
        for source, target, label, relation_type, base_weight in _predicate_relation_pairs(sentence, positioned):
            add_relation(source, target, label, relation_type, sentence, base_weight)

    return sorted(
        relations.values(),
        key=lambda item: (-int(item["weight"]), -int(item["confidence"]), str(item["source"])),
    )[: max(limit, 1)]


def _clean_entity_token(value: str) -> str:
    raw_value = value or ""
    if _API_ENTITY_PATTERN.fullmatch(raw_value.strip()):
        normalized = re.sub(r"\s+", " ", raw_value).strip()
    else:
        normalized = re.sub(r"\s+", "", raw_value)
    normalized = re.sub(r"^(?:文件实体|API实体|接口|字段|配置|模型|知识库|工作区)[：:]", "", normalized)
    token = normalized.strip(" -_，。；;、:：.!?！？()（）[]【】<>《》\"'")
    return token[:90]


def _is_valid_entity(token: str) -> bool:
    if not token:
        return False
    key = token.lower()
    if key in _ENTITY_STOP_WORDS:
        return False
    if token in _GENERIC_ENTITY_NAMES:
        return False
    if token in _RELATION_VERBS:
        return False
    if "/" in token and not (_API_ENTITY_PATTERN.fullmatch(token) or _FILE_ENTITY_PATTERN.fullmatch(token)):
        return False
    if any(token.startswith(prefix) and len(token) > len(prefix) + 2 for prefix in _NOISY_ENTITY_PREFIXES):
        return False
    if any(fragment in token for fragment in _NOISY_ENTITY_FRAGMENTS):
        return False
    if re.search(r"[：:]", token) and len(token) > 16 and not _API_ENTITY_PATTERN.fullmatch(token):
        return False
    if re.search(r"[\u4e00-\u9fffA-Za-z0-9]{2,}(?:和|及|与)[\u4e00-\u9fffA-Za-z0-9]{2,}", token):
        return False
    if any(verb in token for verb in _RELATION_VERBS) and len(token) > 8:
        return False
    if len(token) < 2:
        return False
    if token.isdigit():
        return False
    if len(token) > 2 and len(set(token)) <= 1:
        return False
    return bool(re.search(r"[A-Za-z\u4e00-\u9fff]", token))


def _entity_type(token: str) -> str:
    normalized = token.strip()
    compact = re.sub(r"\s+", "", normalized)
    if _API_ENTITY_PATTERN.fullmatch(normalized):
        return "api"
    if _FILE_ENTITY_PATTERN.fullmatch(normalized) or _FILE_ENTITY_PATTERN.fullmatch(compact):
        return "file"
    if _TECH_ENTITY_PATTERN.fullmatch(normalized):
        return "technology"
    if re.search(r"(?:Workspace|WorkSpace|PersonalWorkspace|EnterpriseWorkspace)$", normalized):
        return "workspace"
    if re.search(r"(?:KnowledgeBase|VectorStore|VectorIndex)$", normalized):
        return "knowledge_base"
    if re.search(r"(?:Auth|Acl|ACL|Permission|Policy|Security|Isolation|Role)$", normalized):
        return "permission"
    if re.search(r"(?:Gateway|Manager|Management|Service|Module|Controller|Dashboard|Platform|System|Center|Log)$", normalized):
        return "module"
    if re.search(r"(?:知识库|向量库)$", compact):
        return "knowledge_base"
    if compact.endswith("工作区") or compact.endswith("工作空间"):
        return "workspace"
    if _CONFIG_ENTITY_PATTERN.fullmatch(normalized) and not _TECH_ENTITY_PATTERN.fullmatch(normalized):
        return "config"
    if re.search(r"权限|角色|安全|隔离|认证|审计|授权|策略", compact):
        return "permission"
    if re.search(r"(?:模块|服务|平台|系统|中心|驾驶舱|工作台)$", compact):
        return "module"
    if re.search(r"上传|解析|切片|入库|同步|删除|重建|调用|生成|检索|审批|归档", compact):
        return "process"
    if normalized.isupper() or re.search(r"[A-Z].*[A-Z]", normalized) or _looks_like_code_token(normalized):
        return "technology"
    return "concept"


def _document_title(filename: str | None) -> str:
    if not filename:
        return ""
    title = re.sub(r"\.[A-Za-z0-9]{1,8}$", "", filename).strip()
    return title[:60]


def _candidate_tokens(line: str) -> list[tuple[str, int, int]]:
    candidates: list[tuple[str, int, int]] = []
    for match in _API_ENTITY_PATTERN.finditer(line):
        candidates.append((match.group(0), match.start(), 34))
    for match in _FILE_ENTITY_PATTERN.finditer(line):
        candidates.append((match.group(0), match.start(), 32))
    for match in re.finditer(r"\b([A-Z][A-Z0-9_]{2,})\s*=", line):
        candidates.append((match.group(1), match.start(1), 24))
    for cell, offset in _table_cells_with_offsets(line):
        if cell and not _is_table_separator_cell(cell):
            candidates.append((cell, offset, 12))
    for token, offset, boost in _relation_entity_candidates(line):
        candidates.append((token, offset, boost))
    for match in _TECH_ENTITY_PATTERN.finditer(line):
        candidates.append((match.group(0), match.start(), 12))
    for match in _CHINESE_ENTITY_PATTERN.finditer(line):
        candidates.append((match.group(0), match.start(), 8))
    for match in re.finditer(r"(?:^|[|,，;；\s])([A-Za-z_][A-Za-z0-9_.-]{2,48})(?=$|[|,，;；\s])", line):
        candidates.append((match.group(1), match.start(1), 7 if _looks_like_code_token(match.group(1)) else 3))
    for match in re.finditer(r"(?:^|[|,，;；\s])([\u4e00-\u9fff]{2,12})(?=$|[|,，;；\s])", line):
        candidates.append((match.group(1), match.start(1), 3))
    for match in re.finditer(r"([^\n。；;，,：:|]{2,28})\s*[：:]", line):
        candidates.append((match.group(1), match.start(1), 10))
    return candidates


def _source_importance_bonus(sources: set[str] | list[str]) -> int:
    score = 0
    source_set = set(sources or [])
    if "title" in source_set:
        score += 18
    if "heading" in source_set:
        score += 16
    if "lead" in source_set or "lead_sentence" in source_set:
        score += 10
    if "table" in source_set:
        score += 12
    if "code" in source_set:
        score += 12
    return min(score, 30)


def _table_cells_with_offsets(line: str) -> list[tuple[str, int]]:
    if "|" not in line:
        return []
    cells: list[tuple[str, int]] = []
    start = 0
    for raw_cell in line.split("|"):
        cell_start = start
        start += len(raw_cell) + 1
        cell = raw_cell.strip()
        if cell:
            cells.append((cell, cell_start + len(raw_cell) - len(raw_cell.lstrip())))
    return cells


def _is_table_separator_cell(value: str) -> bool:
    return bool(re.fullmatch(r":?-{2,}:?", value.strip()))


def _relation_entity_candidates(line: str) -> list[tuple[str, int, int]]:
    candidates: list[tuple[str, int, int]] = []
    for match in _RELATION_HINT_PATTERN.finditer(line):
        if not _is_predicate_hint_match(line, match):
            continue
        subject = _tail_entity_phrase(line[: match.start()])
        if subject:
            candidates.append((subject, max(0, match.start() - len(subject)), 20))
        for token, relative_offset in _split_relation_objects(line[match.end() :]):
            candidates.append((token, match.end() + relative_offset, 18))
    return candidates


def _tail_entity_phrase(text: str) -> str:
    if not text:
        return ""
    parts = re.split(r"[\n。；;！？?!，,、：:（）()\[\]【】<>《》\s]+", text)
    for part in reversed(parts):
        cleaned = _clean_entity_token(part)
        if cleaned:
            return cleaned
    return ""


def _split_relation_objects(text: str) -> list[tuple[str, int]]:
    if not text:
        return []
    clause = re.split(r"[。；;！？?!\n]", text, maxsplit=1)[0]
    clause = re.split(r"\b(?:by|through|via|using|with)\b|并通过|并使用|通过|使用", clause, maxsplit=1, flags=re.IGNORECASE)[0]
    results: list[tuple[str, int]] = []
    separator = re.compile(r"[、,，/]+|(?:和|及|与)|\s+(?:and|or)\s+", re.IGNORECASE)
    start = 0
    for match in separator.finditer(clause):
        raw_token = clause[start : match.start()]
        token = _clean_entity_token(raw_token)
        if token:
            results.append((token, start + len(raw_token) - len(raw_token.lstrip())))
        start = match.end()
    raw_token = clause[start:]
    token = _clean_entity_token(raw_token)
    if token:
        results.append((token, start + len(raw_token) - len(raw_token.lstrip())))
    return results


def _is_predicate_hint_match(text: str, match: re.Match) -> bool:
    hint = match.group(0)
    after = text[match.end() : match.end() + 8]
    if hint in {"管理", "检索", "上传", "解析", "入库", "同步", "生成", "记录", "提供", "支持"}:
        if any(after.startswith(suffix) for suffix in _RELATION_NOUN_SUFFIXES):
            return False
    return True


def _looks_like_heading(line: str) -> bool:
    cleaned = line.strip()
    if not cleaned or len(cleaned) > 42:
        return False
    if re.match(r"^[-*+]\s+", cleaned):
        return False
    if re.match(r"^(#{1,6}|\d+(?:\.\d+)*[、.)]?|[一二三四五六七八九十]+[、.])", cleaned):
        return True
    if cleaned.endswith(("：", ":")):
        return True
    return not re.search(r"[。！？!?；;]", cleaned) and len(cleaned) <= 24


def _looks_like_table_line(line: str) -> bool:
    return line.count("|") >= 2 or line.count("\t") >= 2 or bool(re.search(r"\S+\s{2,}\S+\s{2,}\S+", line))


def _looks_like_code_line(line: str) -> bool:
    return bool(re.search(r"[A-Za-z_][A-Za-z0-9_]*\(|[A-Z_]{3,}|[A-Za-z0-9_]+\.[A-Za-z0-9_.]+|https?://", line))


def _looks_like_code_token(token: str) -> bool:
    return "_" in token or "." in token or "-" in token or token.isupper() or bool(re.search(r"[a-z][A-Z]", token))


def _canonical_entity_name(token: str) -> str:
    normalized = token.strip()
    normalized = re.sub(r"^(?:#{1,6}|\d+(?:\.\d+)*[、.)]?|[一二三四五六七八九十]+[、.])", "", normalized)
    normalized = normalized.strip(" -_：:")
    alias_key = normalized.lower()
    compact_key = re.sub(r"\s+", "", normalized).lower()
    return _ENTITY_CANONICAL_ALIASES.get(alias_key) or _ENTITY_CANONICAL_ALIASES.get(compact_key) or normalized


def _entity_key(entity: str) -> str:
    return re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", "", entity).lower()


def _semantic_type(token: str, source: str = "body") -> str:
    entity_type = _entity_type(token)
    if entity_type == "concept" and source in {"title", "heading"}:
        return "module"
    return entity_type


def _split_relation_sentences(content: str) -> list[str]:
    sentences = []
    for line in (content or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = re.split(r"(?<=[。！？!?；;])", line)
        for part in parts:
            cleaned = part.strip()
            if 4 <= len(cleaned) <= 260:
                sentences.append(cleaned)
    if not sentences and content:
        sentences.append(_preview(content, 260))
    return sentences[:160]


def _structured_relation_pairs(
    content: str,
    entity_lookup: list[tuple[dict, list[str]]],
) -> list[tuple[dict, dict, str, str, int, str]]:
    pairs: list[tuple[dict, dict, str, str, int, str]] = []
    lines = [line.strip() for line in (content or "").splitlines() if line.strip()]
    current_heading: dict | None = None
    table_headers: list[str] | None = None

    for line in lines[:180]:
        if _looks_like_table_line(line):
            cells = [cell for cell, _offset in _table_cells_with_offsets(line)]
            cells = [cell for cell in cells if cell and not _is_table_separator_cell(cell)]
            if not cells:
                continue
            if table_headers is None:
                table_headers = cells
                continue
            source_entities = _entities_in_text(cells[0], entity_lookup)
            if not source_entities:
                continue
            source = source_entities[0]
            for index, cell in enumerate(cells[1:], start=1):
                target_entities = _entities_in_text(cell, entity_lookup)
                if not target_entities:
                    continue
                header = table_headers[index] if index < len(table_headers) else ""
                relation = _relation_from_table_header(header, source, target_entities[0])
                if relation is None:
                    continue
                label, relation_type = relation
                for target in target_entities:
                    pairs.append((source, target, label, relation_type, 62, line))
            continue

        table_headers = None
        heading_entities = _entities_in_text(line, entity_lookup) if _looks_like_heading(line) else []
        if heading_entities:
            current_heading = heading_entities[0]
            continue

        bullet_match = re.match(r"^(?:[-*+]\s+|\d+[.)、]\s+)(.+)$", line)
        if bullet_match and current_heading:
            target_entities = _entities_in_text(bullet_match.group(1), entity_lookup)
            for target in target_entities:
                pairs.append((current_heading, target, "包含", "结构包含", 58, line))

    return pairs


def _relation_from_table_header(header: str, source: dict, target: dict) -> tuple[str, str] | None:
    normalized = header.strip().lower()
    if any(word in normalized for word in ("依赖", "服务", "dependency", "depend")):
        return "依赖", "依赖关系"
    if any(word in normalized for word in ("调用", "api", "接口")):
        return "调用", "调用关系"
    if any(word in normalized for word in ("引用", "reference")):
        return "引用", "引用关系"
    if any(word in normalized for word in ("属于", "归属")):
        return "属于", "归属关系"
    if any(word in normalized for word in ("包含", "组成", "模块", "子项")):
        return "包含", "组成关系"
    if source.get("entity_type") in {"api", "module"} and target.get("entity_type") == "technology":
        return "依赖", "依赖关系"
    return None


def _entities_in_text(sentence: str, entity_lookup: list[tuple[dict, list[str]]]) -> list[dict]:
    return [item["entity"] for item in _entity_positions_in_text(sentence, entity_lookup)]


def _entity_positions_in_text(sentence: str, entity_lookup: list[tuple[dict, list[str]]]) -> list[dict]:
    present: list[dict] = []
    lower_sentence = sentence.lower()
    seen: set[str] = set()
    for entity, aliases in entity_lookup:
        found_alias = ""
        found_position = -1
        for alias in aliases:
            if not alias:
                continue
            position = lower_sentence.find(alias.lower())
            if position >= 0:
                found_alias = alias
                found_position = position
                break
        key = str(entity["canonical_name"])
        if found_position >= 0 and key not in seen:
            present.append(
                {
                    "entity": entity,
                    "position": found_position,
                    "end": found_position + len(found_alias),
                    "alias": found_alias,
                }
            )
            seen.add(key)
    present.sort(key=lambda item: (int(item["position"]), -len(str(item["alias"]))))
    return present


def _predicate_relation_pairs(sentence: str, positioned: list[dict]) -> list[tuple[dict, dict, str, str, int]]:
    pairs: list[tuple[dict, dict, str, str, int]] = []
    seen: set[str] = set()
    hint_meta = {hint.lower(): (label, relation_type) for hint, label, relation_type in _RELATION_SUBJECT_OBJECT_HINTS}
    matches = [match for match in _RELATION_HINT_PATTERN.finditer(sentence) if _is_predicate_hint_match(sentence, match)]

    for match_index, match in enumerate(matches):
        hint = match.group(0)
        label, relation_type = hint_meta.get(hint.lower(), (hint, "文档关系"))
        before = [item for item in positioned if int(item["end"]) <= match.start()]
        next_hint_start = matches[match_index + 1].start() if match_index + 1 < len(matches) else len(sentence)
        after = [
            item
            for item in positioned
            if int(item["position"]) >= match.end() and int(item["position"]) < next_hint_start
        ]
        if not before or not after:
            continue
        source_item = _choose_relation_source(before, hint)
        source = source_item["entity"]
        for target_item in after:
            target = target_item["entity"]
            if source["canonical_name"] == target["canonical_name"]:
                continue
            key = f"{source['canonical_name']}->{target['canonical_name']}:{label}"
            if key in seen:
                continue
            seen.add(key)
            pairs.append((source, target, label, relation_type, _relation_base_weight(label, source, target)))

    return pairs


def _choose_relation_source(before: list[dict], hint: str) -> dict:
    if hint.lower() in {"隔离", "保护", "权限", "isolates", "isolate", "protects", "protect"}:
        scoped = [
            item
            for item in before
            if item["entity"].get("entity_type") in {"workspace", "knowledge_base", "module", "file", "api"}
        ]
        if scoped:
            return max(scoped, key=lambda item: int(item["entity"].get("weight") or 1))
    return max(before, key=lambda item: int(item["end"]))


def _relation_base_weight(label: str, source: dict, target: dict) -> int:
    base_by_label = {
        "属于": 66,
        "包含": 64,
        "依赖": 66,
        "调用": 68,
        "引用": 66,
        "写入": 64,
        "隔离": 70,
        "保护": 68,
        "检索": 62,
    }
    base = base_by_label.get(label, 58)
    if source.get("entity_type") in {"api", "file", "knowledge_base", "workspace"}:
        base += 4
    if target.get("entity_type") in {"technology", "knowledge_base", "permission"}:
        base += 3
    return min(base, 78)


def _entity_node_id(workspace_id: str, entity: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", entity).strip("-").lower()
    if not slug:
        slug = "entity"
    return f"entity:{workspace_id}:{slug[:96]}"


def _preview(value: str, limit: int) -> str:
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned[:limit] if len(cleaned) <= limit else f"{cleaned[:limit]}..."


def _iso(value) -> str:
    if value is None:
        return _now_iso()
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
