from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean


def evaluate_records(records: list[dict], *, top_k: int = 5) -> dict:
    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    context_precisions: list[float] = []
    citation_correct = 0
    citation_total = 0
    latencies: list[float] = []

    for record in records:
        expected = set(map(str, record.get("expected_chunk_ids") or []))
        retrieved = list(map(str, record.get("retrieved_chunk_ids") or []))[:top_k]
        citations = list(map(str, record.get("citation_chunk_ids") or []))
        relevant_retrieved = [chunk_id for chunk_id in retrieved if chunk_id in expected]
        recalls.append(len(set(relevant_retrieved)) / len(expected) if expected else 1.0)
        context_precisions.append(len(relevant_retrieved) / len(retrieved) if retrieved else 0.0)
        first_rank = next(
            (rank for rank, chunk_id in enumerate(retrieved, start=1) if chunk_id in expected),
            None,
        )
        reciprocal_ranks.append(1.0 / first_rank if first_rank else 0.0)
        citation_correct += sum(1 for chunk_id in citations if chunk_id in expected)
        citation_total += len(citations)
        if record.get("latency_ms") is not None:
            latencies.append(float(record["latency_ms"]))

    return {
        "case_count": len(records),
        "top_k": top_k,
        "recall_at_k": _rounded_mean(recalls),
        "mrr": _rounded_mean(reciprocal_ranks),
        "context_precision": _rounded_mean(context_precisions),
        "citation_accuracy": round(citation_correct / citation_total, 6) if citation_total else 0.0,
        "average_latency_ms": _rounded_mean(latencies),
    }


def _rounded_mean(values: list[float]) -> float:
    return round(mean(values), 6) if values else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="企业知识平台 RAG 离线评估")
    parser.add_argument("dataset", type=Path, help="JSON 评估数据集路径")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    records = json.loads(args.dataset.read_text(encoding="utf-8"))
    report = evaluate_records(records, top_k=args.top_k)
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)


if __name__ == "__main__":
    main()
