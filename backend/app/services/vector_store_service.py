from __future__ import annotations

from dataclasses import dataclass
import math
import os
from pathlib import Path
import re

from app.core.config import Settings


class VectorStoreUnavailableError(RuntimeError):
    pass


@dataclass(frozen=True)
class VectorSearchHit:
    chunk_id: str
    document_id: str
    score: float


def upsert_chunk_vectors(
    settings: Settings,
    *,
    workspace_id: str,
    rows: list[dict],
    vectors: list[list[float]],
) -> None:
    if not rows:
        return
    if len(rows) != len(vectors):
        raise ValueError("片段与向量数量不一致")
    collection = _get_collection(settings, dimension=len(vectors[0]))
    chunk_ids = [str(row["chunk_id"]) for row in rows]
    collection.delete(expr=_in_expression("chunk_id", chunk_ids))
    collection.insert(
        [
            chunk_ids,
            [workspace_id] * len(rows),
            [str(row["document_id"]) for row in rows],
            [int(row["chunk_index"]) for row in rows],
            [_prepare_vector(settings, vector) for vector in vectors],
        ]
    )
    collection.flush()


def search_chunk_vectors(
    settings: Settings,
    *,
    workspace_id: str,
    query_vector: list[float],
    limit: int,
    document_ids: list[str] | None = None,
) -> list[VectorSearchHit]:
    collection = _get_collection(settings, dimension=len(query_vector))
    expression = f'workspace_id == "{_escape_value(workspace_id)}"'
    if document_ids:
        expression += f" and {_in_expression('document_id', document_ids)}"
    results = collection.search(
        data=[_prepare_vector(settings, query_vector)],
        anns_field="embedding",
        param={
            "metric_type": _metric_type(settings),
            "params": {} if settings.milvus_uri else {"ef": max(64, limit * 4)},
        },
        limit=max(1, limit),
        expr=expression,
        output_fields=["document_id"],
    )
    hits: list[VectorSearchHit] = []
    for hit in results[0] if results else []:
        entity = getattr(hit, "entity", None)
        document_id = entity.get("document_id") if entity is not None else ""
        hits.append(
            VectorSearchHit(
                chunk_id=str(hit.id),
                document_id=str(document_id),
                score=float(hit.distance),
            )
        )
    return hits


def delete_document_vectors(settings: Settings, *, workspace_id: str, document_id: str) -> None:
    try:
        collection = _get_existing_collection(settings)
    except VectorStoreUnavailableError:
        return
    if collection is None:
        return
    collection.load()
    rows = collection.query(
        expr=(
            f'workspace_id == "{_escape_value(workspace_id)}" and '
            f'document_id == "{_escape_value(document_id)}"'
        ),
        output_fields=["chunk_id"],
    )
    chunk_ids = [str(row["chunk_id"]) for row in rows if row.get("chunk_id")]
    if not chunk_ids:
        return
    collection.delete(expr=_in_expression("chunk_id", chunk_ids))
    collection.flush()


def _get_collection(settings: Settings, *, dimension: int):
    try:
        _prepare_milvus_environment(settings)
        from pymilvus import Collection, CollectionSchema, DataType, FieldSchema, connections, utility

        _connect(settings, connections)
        name = settings.milvus_collection
        if not utility.has_collection(name, using=settings.milvus_alias):
            schema = CollectionSchema(
                fields=[
                    FieldSchema("chunk_id", DataType.VARCHAR, is_primary=True, max_length=64),
                    FieldSchema("workspace_id", DataType.VARCHAR, max_length=64),
                    FieldSchema("document_id", DataType.VARCHAR, max_length=64),
                    FieldSchema("chunk_index", DataType.INT64),
                    FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=dimension),
                ],
                description="企业知识平台文档片段向量",
            )
            collection = Collection(name=name, schema=schema, using=settings.milvus_alias)
            collection.create_index(
                field_name="embedding",
                index_params=_index_params(settings),
            )
        else:
            collection = Collection(name=name, using=settings.milvus_alias)
            vector_field = next(field for field in collection.schema.fields if field.name == "embedding")
            existing_dimension = int(vector_field.params.get("dim", 0))
            if existing_dimension and existing_dimension != dimension:
                raise VectorStoreUnavailableError(
                    f"Milvus 集合维度为 {existing_dimension}，当前模型维度为 {dimension}，请重建向量索引"
                )
            if not collection.indexes:
                collection.create_index(
                    field_name="embedding",
                    index_params=_index_params(settings),
                )
        collection.load()
        return collection
    except VectorStoreUnavailableError:
        raise
    except Exception as exc:
        raise VectorStoreUnavailableError(f"Milvus 不可用：{exc}") from exc


def _get_existing_collection(settings: Settings):
    try:
        _prepare_milvus_environment(settings)
        from pymilvus import Collection, connections, utility

        _connect(settings, connections)
        if not utility.has_collection(settings.milvus_collection, using=settings.milvus_alias):
            return None
        return Collection(settings.milvus_collection, using=settings.milvus_alias)
    except Exception as exc:
        raise VectorStoreUnavailableError(f"Milvus 不可用：{exc}") from exc


def _escape_value(value: str) -> str:
    return re.sub(r'["\\]', "", value)


def _in_expression(field: str, values: list[str]) -> str:
    escaped = ", ".join(f'"{_escape_value(value)}"' for value in values)
    return f"{field} in [{escaped}]"


def _connect(settings: Settings, connections) -> None:
    if settings.milvus_uri:
        connections.connect(alias=settings.milvus_alias, uri=_resolve_milvus_uri(settings.milvus_uri))
        return
    connections.connect(
        alias=settings.milvus_alias,
        host=settings.milvus_host,
        port=str(settings.milvus_grpc_port),
        timeout=settings.vector_timeout_seconds,
    )


def _resolve_milvus_uri(uri: str) -> str:
    normalized = uri.strip()
    if "://" in normalized:
        return normalized
    database_path = Path(normalized).expanduser()
    if not database_path.is_absolute():
        database_path = (Path.cwd() / database_path).resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    return str(database_path)


def _prepare_milvus_environment(settings: Settings) -> None:
    if settings.milvus_uri:
        resolved_uri = _resolve_milvus_uri(settings.milvus_uri)
        if "://" in resolved_uri:
            os.environ["MILVUS_URI"] = resolved_uri
        else:
            # pymilvus treats its MILVUS_URI environment variable as a remote
            # HTTP endpoint. Milvus Lite paths must be passed to connect().
            previous_uri = os.environ.pop("MILVUS_URI", None)
            try:
                __import__("pymilvus")
            finally:
                if previous_uri is not None:
                    os.environ["MILVUS_URI"] = previous_uri
            if settings.milvus_alias == "default":
                settings.milvus_alias = "rag_lite"


def _metric_type(settings: Settings) -> str:
    metric_type = settings.milvus_metric_type.upper()
    if metric_type not in {"COSINE", "IP"}:
        raise VectorStoreUnavailableError(f"Unsupported Milvus metric type: {metric_type}")
    return metric_type


def _index_params(settings: Settings) -> dict:
    metric_type = _metric_type(settings)
    if settings.milvus_uri:
        return {"metric_type": metric_type, "index_type": "AUTOINDEX", "params": {}}
    return {
        "metric_type": metric_type,
        "index_type": "HNSW",
        "params": {"M": 16, "efConstruction": 200},
    }


def _prepare_vector(settings: Settings, vector: list[float]) -> list[float]:
    if _metric_type(settings) != "IP":
        return vector
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]
