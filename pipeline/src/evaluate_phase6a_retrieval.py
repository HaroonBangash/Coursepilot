import json
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import answer  # noqa: E402
import evaluate_phase5_1 as p51  # noqa: E402


def load_jsonl(path: Path):
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def summarize_with_required_metrics(df: pd.DataFrame, summary: dict):
    out = dict(summary)
    out["retrieval_success_rate"] = float((df["retrieval_status"] == "retrieval_success").mean())
    out["weak_or_misaligned_citation_count"] = int((df["citation_quality"] != "correct").sum())
    return out


def to_row(label: str, s: dict):
    return {
        "system": label,
        "retrieval_success_rate": s["retrieval_success_rate"],
        "answer_correct_rate": s["answer_correct_rate"],
        "answer_partly_correct_rate": s["answer_partly_correct_rate"],
        "citation_correct_rate": s["citation_correct_rate"],
        "refusal_accuracy": s["refusal_accuracy"],
        "unsupported_over_answer_rate": s["unsupported_over_answer_rate"],
        "weak_or_misaligned_citation_count": s["weak_or_misaligned_citation_count"],
    }


def main():
    out_dir = config.EVAL_DIR / "phase6a"
    out_dir.mkdir(parents=True, exist_ok=True)

    base_bench = load_jsonl(config.EVAL_DIR / "benchmark_questions_v2_36.jsonl")
    hard_neg = load_jsonl(config.EVAL_DIR / "benchmark_questions_phase5_1_hard_negatives.jsonl")
    benchmark = base_bench + hard_neg

    params = p51.Params(
        strong_score=0.72,
        partial_score=0.66,
        strong_chunks=1,
        kw_supported=0.45,
        kw_partial=0.25,
        min_correct_supported=2,
        min_correct_partial=1,
        allow_weak_partial=False,
        ambiguity_guardrail=False,
        ambiguity_kw_min=0.50,
    )

    baseline_retriever = answer.Retriever(use_hybrid=False, alpha=0.65)
    hardened_retriever = answer.Retriever(
        use_hybrid=False,
        alpha=0.65,
        enable_rerank=True,
        retrieve_pool_k=20,
        enable_dedup=True,
        enable_metadata_filter=True,
    )

    base_cache = p51.build_cached_features(benchmark, baseline_retriever)
    hard_cache = p51.build_cached_features(benchmark, hardened_retriever)

    base_df, base_summary = p51.evaluate(benchmark, params, base_cache)
    hard_df, hard_summary = p51.evaluate(benchmark, params, hard_cache)

    base_summary = summarize_with_required_metrics(base_df, base_summary)
    hard_summary = summarize_with_required_metrics(hard_df, hard_summary)

    rows = [to_row("baseline_final", base_summary), to_row("phase6a_retrieval_hardened", hard_summary)]
    comp = pd.DataFrame(rows)

    delta = {k: hard_summary[k] - base_summary[k] for k in [
        "retrieval_success_rate",
        "answer_correct_rate",
        "answer_partly_correct_rate",
        "citation_correct_rate",
        "refusal_accuracy",
        "unsupported_over_answer_rate",
    ]}
    delta["weak_or_misaligned_citation_count"] = hard_summary["weak_or_misaligned_citation_count"] - base_summary["weak_or_misaligned_citation_count"]

    base_df.to_csv(out_dir / "per_question_baseline.csv", index=False)
    hard_df.to_csv(out_dir / "per_question_phase6a_hardened.csv", index=False)
    comp.to_csv(out_dir / "phase6a_before_after_comparison.csv", index=False)

    payload = {
        "benchmark_size": len(benchmark),
        "benchmark_breakdown": {"base": len(base_bench), "hard_negatives": len(hard_neg)},
        "baseline": base_summary,
        "phase6a_hardened": hard_summary,
        "delta_hardened_minus_baseline": delta,
        "hardening_config": {
            "dense_base": True,
            "retrieve_pool_k": 20,
            "reranker": "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "dedup_enabled": True,
            "source_diversity_cap": 2,
            "metadata_filter_query_implied_only": True,
            "llm_generation_changes": False,
        },
    }
    (out_dir / "phase6a_summary.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Phase 6A Retrieval Hardening Report",
        "",
        "Scope: retrieval-only hardening (no grounded LLM generation stage changes).",
        "",
        f"Benchmark size: {len(benchmark)} (base={len(base_bench)}, hard_negatives={len(hard_neg)})",
        "",
        "## Metrics (before vs after)",
        comp.to_csv(index=False),
        "",
        "## Delta (hardened - baseline)",
        f"- retrieval_success_rate: {delta['retrieval_success_rate']:+.4f}",
        f"- answer_correct_rate: {delta['answer_correct_rate']:+.4f}",
        f"- answer_partly_correct_rate: {delta['answer_partly_correct_rate']:+.4f}",
        f"- citation_correct_rate: {delta['citation_correct_rate']:+.4f}",
        f"- refusal_accuracy: {delta['refusal_accuracy']:+.4f}",
        f"- unsupported_over_answer_rate: {delta['unsupported_over_answer_rate']:+.4f}",
        f"- weak_or_misaligned_citation_count: {delta['weak_or_misaligned_citation_count']:+d}",
    ]
    (out_dir / "phase6a_report.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Saved: {out_dir / 'phase6a_before_after_comparison.csv'}")
    print(f"Saved: {out_dir / 'phase6a_summary.json'}")
    print(f"Saved: {out_dir / 'phase6a_report.md'}")


if __name__ == "__main__":
    main()
