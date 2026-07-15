from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import Settings


class EmbeddingUnavailableError(RuntimeError):
    pass


def embed_texts(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    provider = settings.embedding_provider.lower()
    if provider == "ollama":
        return _embed_with_ollama(settings, texts)
    if provider in {"openai", "openai-compatible"}:
        return _embed_with_openai_compatible(settings, texts)
    raise EmbeddingUnavailableError(f"不支持的 Embedding 提供方：{provider}")


def embed_query(settings: Settings, query: str) -> list[float]:
    embeddings = embed_texts(settings, [query])
    if not embeddings or not embeddings[0]:
        raise EmbeddingUnavailableError("Embedding 服务没有返回向量")
    return embeddings[0]


def _embed_with_ollama(settings: Settings, texts: list[str]) -> list[list[float]]:
    base_url = settings.embedding_base_url or settings.ollama_base_url
    payload = {"model": settings.embedding_model, "input": texts}
    try:
        data = _post_json(f"{base_url.rstrip('/')}/api/embed", payload, timeout=settings.embedding_timeout_seconds)
        embeddings = data.get("embeddings")
        if isinstance(embeddings, list) and embeddings:
            return embeddings
    except EmbeddingUnavailableError:
        if len(texts) != 1:
            raise
    data = _post_json(
        f"{base_url.rstrip('/')}/api/embeddings",
        {"model": settings.embedding_model, "prompt": texts[0]},
        timeout=settings.embedding_timeout_seconds,
    )
    embedding = data.get("embedding")
    if not isinstance(embedding, list) or not embedding:
        raise EmbeddingUnavailableError("Ollama 没有返回有效向量")
    return [embedding]


def _embed_with_openai_compatible(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not settings.embedding_api_key:
        raise EmbeddingUnavailableError("未配置 EMBEDDING_API_KEY")
    data = _post_json(
        f"{settings.embedding_base_url.rstrip('/')}/embeddings",
        {"model": settings.embedding_model, "input": texts},
        timeout=settings.embedding_timeout_seconds,
        headers={"Authorization": f"Bearer {settings.embedding_api_key}"},
    )
    rows = data.get("data")
    if not isinstance(rows, list):
        raise EmbeddingUnavailableError("Embedding API 返回格式不正确")
    ordered = sorted(rows, key=lambda item: item.get("index", 0))
    embeddings = [item.get("embedding") for item in ordered]
    if len(embeddings) != len(texts) or any(not isinstance(item, list) for item in embeddings):
        raise EmbeddingUnavailableError("Embedding API 返回的向量数量不匹配")
    return embeddings


def _post_json(
    url: str,
    payload: dict,
    *,
    timeout: int,
    headers: dict[str, str] | None = None,
) -> dict:
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise EmbeddingUnavailableError(f"Embedding 服务不可用：{exc}") from exc
