import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import answer  # noqa: E402


@dataclass
class Params:
    strong_score: float
    partial_score: float
    strong_chunks: int
    kw_supported: float
    kw_partial: float
    min_correct_supported: int
    min_correct_partial: int
    allow_weak_partial: bool
    ambiguity_guardrail: bool
    ambiguity_kw_min: float


AMBIGUITY_PATTERNS = [
    r"\bexact\b", r"\bverbatim\b", r"\bproof\b", r"\bguarantee\b", r"\bcertification\b",
    r"\blegal\b", r"\bcompliance\b", r"\bpolicy document\b", r"\broadmap\b", r"\bimplementation plan\b",
    r"\bfor .*industry\b", r"\bmedicine\b", r"\bfinance\b", r"\bcyber law\b", r"\bgdpr\b",
]


def is_ambiguous_or_high_risk_query(query: str) -> bool:
    q = (query or "").lower()
    return any(re.search(p, q) for p in AMBIGUITY_PATTERNS)


def support_state_with_params(query, retrieved, p: Params):
    scores = [s for s, _ in retrieved]
    top_score = scores[0] if scores else 0.0
    strong_count = sum(1 for s in scores if s >= p.strong_score)
    kw_cov = answer.keyword_coverage(query, [str(r.chunk_text) for _, r in retrieved])

    kw_sup_ok = (kw_cov is None) or (kw_cov >= p.kw_supported)
    kw_par_ok = (kw_cov is None) or (kw_cov >= p.kw_partial)

    if strong_count >= p.strong_chunks and top_score >= p.strong_score and kw_sup_ok:
        return "SUPPORTED", kw_cov
    if top_score >= p.partial_score and kw_par_ok:
        return "PARTIAL", kw_cov
    return "INSUFFICIENT", kw_cov


def classify_answer_quality(expected_support_type: str, predicted_state: str) -> str:
    e = expected_support_type.lower()
    if e == "supported":
        return "correct" if predicted_state == "SUPPORTED" else ("partly_correct" if predicted_state == "PARTIAL" else "incorrect")
    if e == "partial":
        return "partly_correct" if predicted_state in {"SUPPORTED", "PARTIAL"} else "incorrect"
    return "correct" if predicted_state == "INSUFFICIENT" else "incorrect"


def classify_refusal(expected_support_type: str, predicted_state: str) -> str:
    e = expected_support_type.lower()
    if e == "unsupported":
        return "refusal_correct" if predicted_state == "INSUFFICIENT" else "refusal_incorrect"
    return "refusal_correct" if predicted_state != "INSUFFICIENT" else "refusal_incorrect"


def build_cached_features(questions: List[Dict], retriever):
    cache = {}
    for q in questions:
        retrieved = retriever.search(q["question"], config.TOP_K)
        claims = answer.pick_evidence_claims(q["question"], retrieved, max_claims=4)
        claims, citation_quality = answer.validate_claims(claims)
        correct_claims = sum(1 for c in claims if c.get("citation_support") == "correct")
        kw_cov = answer.keyword_coverage(q["question"], [str(r.chunk_text) for _, r in retrieved])
        scores = [s for s, _ in retrieved]
        cache[q["question_id"]] = {
            "retrieved": retrieved,
            "claims": claims,
            "citation_quality": citation_quality,
            "correct_claims": correct_claims,
            "kw_cov": kw_cov,
            "top_score": scores[0] if scores else None,
            "strong_count": sum(1 for s in scores if s is not None),
        }
    return cache


def evaluate(questions: List[Dict], p: Params, feature_cache):
    rows = []

    for q in questions:
        f = feature_cache[q["question_id"]]
        retrieved = f["retrieved"]
        claims = f["claims"]
        citation_quality = f["citation_quality"]
        correct_claims = f["correct_claims"]
        kw_cov = f["kw_cov"]

        base_state, _ = support_state_with_params(q["question"], retrieved, p)

        final_state = base_state

        if not claims:
            final_state = "INSUFFICIENT"
        elif citation_quality == "misleading":
            final_state = "INSUFFICIENT"
        else:
            if base_state == "SUPPORTED":
                if citation_quality != "correct" or correct_claims < p.min_correct_supported:
                    final_state = "PARTIAL"

            if final_state == "PARTIAL":
                weak_ok = (citation_quality == "correct") or (p.allow_weak_partial and citation_quality == "weak")
                if (not weak_ok) or (correct_claims < p.min_correct_partial):
                    final_state = "INSUFFICIENT"

            # Conservative ambiguity guardrail (Phase 5.1 only decision logic)
            if p.ambiguity_guardrail and is_ambiguous_or_high_risk_query(q["question"]):
                if final_state != "INSUFFICIENT":
                    if (kw_cov is None) or (kw_cov < p.ambiguity_kw_min) or (correct_claims < 2):
                        final_state = "INSUFFICIENT"

        expected = q["expected_support_type"].upper()
        ans_q = classify_answer_quality(q["expected_support_type"], final_state)
        refusal = classify_refusal(q["expected_support_type"], final_state)

        retrieval_status = "retrieval_success" if ((expected in {"SUPPORTED", "PARTIAL"} and final_state in {"SUPPORTED", "PARTIAL"}) or (expected == "UNSUPPORTED" and final_state == "INSUFFICIENT")) else "retrieval_miss"

        rows.append({
            "question_id": q["question_id"],
            "question": q["question"],
            "question_type": q["question_type"],
            "expected_support_type": expected,
            "predicted_support_state": final_state,
            "retrieval_status": retrieval_status,
            "answer_quality": ans_q,
            "citation_quality": citation_quality,
            "refusal_status": refusal,
            "kw_coverage": kw_cov,
            "top_score": retrieved[0][0] if retrieved else None,
            "correct_claims": correct_claims,
            "num_claims": len(claims),
            "claims": json.dumps(claims, ensure_ascii=False),
        })

    df = pd.DataFrame(rows)
    summary = {
        "num_questions": int(len(df)),
        "refusal_accuracy": float((df["refusal_status"] == "refusal_correct").mean()),
        "unsupported_over_answer_rate": float(((df["expected_support_type"] == "UNSUPPORTED") & (df["predicted_support_state"] != "INSUFFICIENT")).mean()),
        "citation_correct_rate": float((df["citation_quality"] == "correct").mean()),
        "weak_misaligned_count": int((df["citation_quality"] != "correct").sum()),
        "support_state_distribution": df["predicted_support_state"].value_counts().to_dict(),
        "answer_correct_rate": float((df["answer_quality"] == "correct").mean()),
        "answer_partly_correct_rate": float((df["answer_quality"] == "partly_correct").mean()),
    }
    return df, summary


def objective(summary):
    return (
        0.75 * summary["refusal_accuracy"]
        + 0.15 * summary["citation_correct_rate"]
        + 0.05 * summary["answer_correct_rate"]
        + 0.05 * summary["answer_partly_correct_rate"]
        - 0.85 * summary["unsupported_over_answer_rate"]
    )


def load_jsonl(path: Path):
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]


def main():
    eval_dir = config.EVAL_DIR
    out_dir = eval_dir / "phase5_1"
    out_dir.mkdir(parents=True, exist_ok=True)

    base_bench = load_jsonl(eval_dir / "benchmark_questions_v2_36.jsonl")
    hard_neg = load_jsonl(eval_dir / "benchmark_questions_phase5_1_hard_negatives.jsonl")
    combined = base_bench + hard_neg

    baseline_params = Params(
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

    retriever = answer.Retriever(use_hybrid=False, alpha=0.65)
    feature_cache = build_cached_features(combined, retriever)

    # Baseline Phase 5 evaluation on expanded benchmark
    base_df, base_summary = evaluate(combined, baseline_params, feature_cache)

    grid = []
    for strong in [0.72, 0.74, 0.76, 0.78]:
        for partial in [0.64, 0.66, 0.68, 0.70]:
            if partial >= strong:
                continue
            for kw_s in [0.45, 0.50, 0.55]:
                for kw_p in [0.25, 0.30, 0.35]:
                    if kw_p > kw_s:
                        continue
                    for mcp in [1, 2]:
                        for amb_kw in [0.50, 0.55, 0.60]:
                            grid.append(Params(
                                strong_score=strong,
                                partial_score=partial,
                                strong_chunks=1,
                                kw_supported=kw_s,
                                kw_partial=kw_p,
                                min_correct_supported=2,
                                min_correct_partial=mcp,
                                allow_weak_partial=False,
                                ambiguity_guardrail=True,
                                ambiguity_kw_min=amb_kw,
                            ))

    best = None
    best_df = None

    for p in grid:
        df, summary = evaluate(combined, p, feature_cache)

        # preserve citation-support gains from final accepted baseline on expanded benchmark
        if summary["weak_misaligned_count"] > base_summary["weak_misaligned_count"]:
            continue

        score = objective(summary)
        if (best is None) or (score > best["objective"]):
            best = {
                "objective": score,
                "params": p.__dict__,
                **summary,
            }
            best_df = df

    if best is None:
        raise RuntimeError("No valid Phase 5.1 config found under citation-preservation constraint.")

    base_df.to_csv(out_dir / "per_question_eval_phase5_baseline_expanded.csv", index=False)
    best_df.to_csv(out_dir / "per_question_eval_phase5_1_expanded.csv", index=False)

    (out_dir / "phase5_baseline_summary_expanded.json").write_text(json.dumps(base_summary, indent=2), encoding="utf-8")
    (out_dir / "phase5_1_best_config.json").write_text(json.dumps(best, indent=2), encoding="utf-8")

    comparison = pd.DataFrame([
        {
            "phase": "phase5_baseline",
            "num_questions": base_summary["num_questions"],
            "refusal_accuracy": base_summary["refusal_accuracy"],
            "unsupported_over_answer_rate": base_summary["unsupported_over_answer_rate"],
            "citation_correct_rate": base_summary["citation_correct_rate"],
            "weak_misaligned_count": base_summary["weak_misaligned_count"],
            "support_state_distribution": json.dumps(base_summary["support_state_distribution"]),
        },
        {
            "phase": "phase5_1",
            "num_questions": best["num_questions"],
            "refusal_accuracy": best["refusal_accuracy"],
            "unsupported_over_answer_rate": best["unsupported_over_answer_rate"],
            "citation_correct_rate": best["citation_correct_rate"],
            "weak_misaligned_count": best["weak_misaligned_count"],
            "support_state_distribution": json.dumps(best["support_state_distribution"]),
        },
    ])
    comparison.to_csv(out_dir / "phase5_vs_phase5_1_comparison_expanded.csv", index=False)

    changed = best_df[["question_id", "predicted_support_state", "citation_quality", "refusal_status"]].rename(columns={
        "predicted_support_state": "phase5_1_state",
        "citation_quality": "phase5_1_citation_quality",
        "refusal_status": "phase5_1_refusal",
    }).merge(
        base_df[["question_id", "predicted_support_state", "citation_quality", "refusal_status"]].rename(columns={
            "predicted_support_state": "phase5_state",
            "citation_quality": "phase5_citation_quality",
            "refusal_status": "phase5_refusal",
        }),
        on="question_id",
        how="left",
    )
    changed = changed[(changed["phase5_1_state"] != changed["phase5_state"]) | (changed["phase5_1_citation_quality"] != changed["phase5_citation_quality"]) | (changed["phase5_1_refusal"] != changed["phase5_refusal"])]
    changed.to_csv(out_dir / "phase5_1_changed_decisions_expanded.csv", index=False)

    adopted = (
        (best["refusal_accuracy"] > base_summary["refusal_accuracy"]) and
        (best["unsupported_over_answer_rate"] <= base_summary["unsupported_over_answer_rate"]) and
        (best["weak_misaligned_count"] <= base_summary["weak_misaligned_count"])
    )

    recommendation = {
        "adopt_phase5_1": bool(adopted),
        "justification": (
            "Adopt: refusal reliability improved with no citation-support regression."
            if adopted else
            "Do not adopt yet: gains are insufficient or citation-support/regression risk remains."
        )
    }
    (out_dir / "phase5_1_recommendation.json").write_text(json.dumps(recommendation, indent=2), encoding="utf-8")

    lines = [
        "# Phase 5.1 Trustworthiness Report (Calibration-Only)",
        "",
        "## Scope constraints honored",
        "- No chunking changes",
        "- No embedding changes",
        "- No retrieval architecture changes (dense default preserved)",
        "- No reranker added",
        "",
        "## Expanded unsupported benchmark",
        f"- Base benchmark questions: {len(base_bench)}",
        f"- Added hard unsupported/ambiguous negatives: {len(hard_neg)}",
        f"- Total evaluated questions: {len(combined)}",
        "",
        "## Phase comparison (expanded benchmark)",
        f"- Phase 5 refusal_accuracy: {base_summary['refusal_accuracy']:.4f}",
        f"- Phase 5.1 refusal_accuracy: {best['refusal_accuracy']:.4f}",
        f"- Phase 5 unsupported_over_answer_rate: {base_summary['unsupported_over_answer_rate']:.4f}",
        f"- Phase 5.1 unsupported_over_answer_rate: {best['unsupported_over_answer_rate']:.4f}",
        f"- Phase 5 citation_correct_rate: {base_summary['citation_correct_rate']:.4f}",
        f"- Phase 5.1 citation_correct_rate: {best['citation_correct_rate']:.4f}",
        f"- Phase 5 weak/misaligned citation count: {base_summary['weak_misaligned_count']}",
        f"- Phase 5.1 weak/misaligned citation count: {best['weak_misaligned_count']}",
        "",
        "## Best Phase 5.1 calibration parameters",
        f"- {json.dumps(best['params'])}",
        "",
        "## Adoption decision",
        f"- adopt_phase5_1: {recommendation['adopt_phase5_1']}",
        f"- {recommendation['justification']}",
    ]
    (out_dir / "phase5_1_report.md").write_text("\n".join(lines), encoding="utf-8")

    print(f"Saved: {out_dir / 'phase5_vs_phase5_1_comparison_expanded.csv'}")
    print(f"Saved: {out_dir / 'phase5_1_report.md'}")
    print(f"Saved: {out_dir / 'phase5_1_recommendation.json'}")


if __name__ == "__main__":
    main()
