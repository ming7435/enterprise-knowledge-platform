from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, replace
from functools import lru_cache
import math
import re
from typing import Iterable


_LATIN_OR_NUMBER = re.compile(r"[a-z0-9][a-z0-9_.:/+-]*", re.IGNORECASE)
_CJK_SEQUENCE = re.compile(r"[\u4e00-\u9fff]+")


@dataclass(frozen=True)
class RetrievalCandidate:
    chunk_id: str
    workspace_id: str
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float = 0.0
    retrieval_method: str = "unknown"
    page_number: int | None = None
    section: str | None = None
    vector_score: float | None = None
    keyword_score: float | None = None
    metadata: dict | None = None


def tokenize_for_retrieval(text: str) -> list[str]:
    """为中英文混合文档生成稳定的 BM25 词元。"""
    normalized = text.lower().strip()
    tokens = _LATIN_OR_NUMBER.findall(normalized)
    for sequence in _CJK_SEQUENCE.findall(normalized):
        tokens.extend(sequence)
        if len(sequence) > 1:
            tokens.extend(sequence[index : index + 2] for index in range(len(sequence) - 1))
    return tokens


def bm25_rank(
    query: str,
    candidates: Iterable[RetrievalCandidate],
    *,
    limit: int,
    k1: float = 1.5,
    b: float = 0.75,
) -> list[RetrievalCandidate]:
    corpus = list(candidates)
    query_tokens = list(dict.fromkeys(tokenize_for_retrieval(query)))
    if not corpus or not query_tokens:
        return []

    tokenized = [tokenize_for_retrieval(item.content) for item in corpus]
    average_length = sum(len(tokens) for tokens in tokenized) / max(len(tokenized), 1)
    document_frequency: Counter[str] = Counter()
    for tokens in tokenized:
        document_frequency.update(set(tokens))

    ranked: list[RetrievalCandidate] = []
    corpus_size = len(corpus)
    for candidate, tokens in zip(corpus, tokenized, strict=True):
        frequencies = Counter(tokens)
        document_length = len(tokens)
        score = 0.0
        for token in query_tokens:
            frequency = frequencies[token]
            if frequency == 0:
                continue
            frequency_in_corpus = document_frequency[token]
            inverse_document_frequency = math.log(
                1 + (corpus_size - frequency_in_corpus + 0.5) / (frequency_in_corpus + 0.5)
            )
            denominator = frequency + k1 * (
                1 - b + b * document_length / max(average_length, 1)
            )
            score += inverse_document_frequency * frequency * (k1 + 1) / denominator
        if score > 0:
            ranked.append(
                replace(
                    candidate,
                    score=score,
                    keyword_score=score,
                    retrieval_method="bm25",
                )
            )

    ranked.sort(key=lambda item: (-item.score, item.chunk_id))
    return ranked[: max(1, limit)]


def reciprocal_rank_fusion(
    rankings: dict[str, list[RetrievalCandidate]],
    *,
    workspace_id: str,
    allowed_document_ids: set[str] | None,
    limit: int,
    rank_constant: int = 60,
) -> list[RetrievalCandidate]:
    """融合多路召回，并在融合层再次执行工作区与文档边界校验。"""
    scores: dict[str, float] = defaultdict(float)
    candidates: dict[str, RetrievalCandidate] = {}
    methods: dict[str, set[str]] = defaultdict(set)

    for method, items in rankings.items():
        for rank, item in enumerate(items, start=1):
            if item.workspace_id != workspace_id:
                continue
            if allowed_document_ids is not None and item.document_id not in allowed_document_ids:
                continue
            scores[item.chunk_id] += 1.0 / (rank_constant + rank)
            methods[item.chunk_id].add(method)
            previous = candidates.get(item.chunk_id)
            if previous is None:
                candidates[item.chunk_id] = item
            else:
                candidates[item.chunk_id] = replace(
                    previous,
                    vector_score=previous.vector_score or item.vector_score,
                    keyword_score=previous.keyword_score or item.keyword_score,
                )

    ordered_ids = sorted(scores, key=lambda chunk_id: (-scores[chunk_id], chunk_id))
    maximum_score = max(scores.values(), default=1.0)
    fused: list[RetrievalCandidate] = []
    for chunk_id in ordered_ids[: max(1, limit)]:
        matched_methods = methods[chunk_id]
        method = "hybrid" if len(matched_methods) > 1 else next(iter(matched_methods), "unknown")
        fused.append(
            replace(
                candidates[chunk_id],
                score=scores[chunk_id] / maximum_score,
                retrieval_method=method,
            )
        )
    return fused


def rerank_candidates(
    query: str,
    candidates: list[RetrievalCandidate],
    *,
    model_path: str,
    limit: int,
) -> tuple[list[RetrievalCandidate], str | None]:
    """使用本地 CrossEncoder 重排；依赖或模型不可用时返回原排序与原因。"""
    if not candidates:
        return [], None
    try:
        model = _load_cross_encoder(model_path)
        scores = model.predict([(query, item.content) for item in candidates])
    except Exception as exc:  # 可选能力必须可解释地降级
        return candidates[:limit], str(exc)

    reranked = [
        replace(
            item,
            score=_sigmoid_score(float(score)),
            retrieval_method=f"{item.retrieval_method}+rerank",
        )
        for item, score in zip(candidates, scores, strict=True)
    ]
    reranked.sort(key=lambda item: item.score, reverse=True)
    return reranked[:limit], None


@lru_cache(maxsize=2)
def _load_cross_encoder(model_path: str):
    from sentence_transformers import CrossEncoder

    return CrossEncoder(model_path, local_files_only=True)


def _sigmoid_score(value: float) -> float:
    bounded = max(min(value, 50.0), -50.0)
    return 1.0 / (1.0 + math.exp(-bounded))
