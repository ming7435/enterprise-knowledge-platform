from __future__ import annotations

import time

from fastapi import FastAPI, Request, Response


try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

    HTTP_REQUESTS = Counter(
        "ekp_http_requests_total",
        "HTTP 请求总数",
        ["method", "path", "status"],
    )
    HTTP_DURATION = Histogram(
        "ekp_http_request_duration_seconds",
        "HTTP 请求耗时",
        ["method", "path"],
    )
    RAG_REQUESTS = Counter(
        "ekp_rag_requests_total",
        "RAG 问答总数",
        ["mode", "model"],
    )
    RAG_SOURCES = Histogram(
        "ekp_rag_sources_count",
        "单次 RAG 返回的来源数量",
        buckets=(0, 1, 2, 3, 5, 8, 13, 20),
    )
    RAG_TOKENS = Counter(
        "ekp_rag_estimated_tokens_total",
        "RAG 估算 Token 数",
        ["kind"],
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False


def install_metrics(app: FastAPI, *, enabled: bool) -> None:
    if not enabled or not PROMETHEUS_AVAILABLE:
        return

    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        HTTP_REQUESTS.labels(request.method, path, str(response.status_code)).inc()
        HTTP_DURATION.labels(request.method, path).observe(time.perf_counter() - started)
        return response

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


def record_rag_result(*, use_knowledge_base: bool, model_name: str, source_count: int, question: str, answer: str) -> None:
    if not PROMETHEUS_AVAILABLE:
        return
    RAG_REQUESTS.labels("rag" if use_knowledge_base else "normal", model_name).inc()
    RAG_SOURCES.observe(source_count)
    RAG_TOKENS.labels("input").inc(_estimate_tokens(question))
    RAG_TOKENS.labels("output").inc(_estimate_tokens(answer))


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 3)
