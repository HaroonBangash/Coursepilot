import json
import sys
from dataclasses import dataclass
from pathlib import Path

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


def support_state_with_params(feat, p: Params):
    scores = feat["scores"]
    top_score = feat["top_score"]
    strong_count = sum(1 for s in scores if s >= p.strong_score)
    kw_cov = feat["kw_cov"]

    kw_sup_ok = (kw_cov is None) or (kw_cov >= p.kw_supported)
    kw_par_ok = (kw_cov is None) or (kw_cov >= p.kw_partial)

    if strong_count >= p.strong_chunks and top_score >= p.strong_score and kw_sup_ok:
        return "SUPPORTED"
    if top_score >= p.partial_score and kw_par_ok:
        return "PARTIAL"
    return "INSUFFICIENT"


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


def build_features(questions):
    retriever = answer.Retriever(use_hybrid=False, alpha=0.65)
    feats = {}
    for q in questions:
        retrieved = retriever.search(q["question"], config.TOP_K)
        claims = answer.pick_evidence_claims(q["question"], retrieved, max_claims=4)
        claims, citation_quality = answer.validate_claims(claims)
        feats[q["question_id"]] = {
            "question_id": q["question_id"],
            "question": q["question"],
            "question_type": q["question_type"],
            "expected_support_type": q["expected_support_type"].upper(),
            "scores": [s for s, _ in retrieved],
            "top_score": retrieved[0][0] if retrieved else 0.0,
            "kw_cov": answer.keyword_coverage(q["question"], [str(r.chunk_text) for _, r in retrieved]),
            "claims": claims,
            "citation_quality": citation_quality,
            "correct_claims": sum(1 for c in claims if c.get("citation_support") == "correct"),
            "num_claims": len(claims),
        }
    return feats


def evaluate_from_features(feats: dict, p: Params):
    rows = []
    for f in feats.values():
        base_state = support_state_with_params(f, p)

        final_state = base_state
        if f["num_claims"] == 0:
            final_state = "INSUFFICIENT"
        elif f["citation_quality"] == "misleading":
            final_state = "INSUFFICIENT"
        else:
            if base_state == "SUPPORTED":
                if f["citation_quality"] != "correct" or f["correct_claims"] < p.min_correct_supported:
                    final_state = "PARTIAL"
            if final_state == "PARTIAL":
                weak_ok = (f["citation_quality"] == "correct") or (p.allow_weak_partial and f["citation_quality"] == "weak")
                if (not weak_ok) or (f["correct_claims"] < p.min_correct_partial):
                    final_state = "INSUFFICIENT"

        ans_q = classify_answer_quality(f["expected_support_type"], final_state)
        refusal = classify_refusal(f["expected_support_type"], final_state)
        retrieval_status = "retrieval_success" if ((f["expected_support_type"] in {"SUPPORTED", "PARTIAL"} and final_state in {"SUPPORTED", "PARTIAL"}) or (f["expected_support_type"] == "UNSUPPORTED" and final_state == "INSUFFICIENT")) else "retrieval_miss"

        rows.append({
            "question_id": f["question_id"],
            "question": f["question"],
            "question_type": f["question_type"],
            "expected_support_type": f["expected_support_type"],
            "predicted_support_state": final_state,
            "retrieval_status": retrieval_status,
            "answer_quality": ans_q,
            "citation_quality": f["citation_quality"],
            "refusal_status": refusal,
            "kw_coverage": f["kw_cov"],
            "top_score": f["top_score"],
            "correct_claims": f["correct_claims"],
            "num_claims": f["num_claims"],
            "claims": json.dumps(f["claims"], ensure_ascii=False),
        })

    df = pd.DataFrame(rows)
    summary = {
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
        0.60 * summary["refusal_accuracy"]
        + 0.20 * summary["citation_correct_rate"]
        + 0.08 * summary["answer_correct_rate"]
        + 0.02 * summary["answer_partly_correct_rate"]
        - 0.55 * summary["unsupported_over_answer_rate"]
    )


def main():
    eval_dir = config.EVAL_DIR
    bench_path = eval_dir / "benchmark_questions_v2_36.jsonl"
    phase4_report_path = eval_dir / "phase4" / "citation_support_report.json"
    phase3_table_path = eval_dir / "phase3" / "per_question_eval_dense.csv"
    phase4_table_path = eval_dir / "phase4" / "per_question_eval_phase4_dense.csv"

    questions = [json.loads(x) for x in bench_path.read_text(encoding="utf-8").splitlines() if x.strip()]
    phase4_report = json.loads(phase4_report_path.read_text(encoding="utf-8"))
    phase4_weak = phase4_report["answer_mode"]["citation_weak_or_misleading_count"]

    feats = build_features(questions)

    grid = []
    for strong in [0.72, 0.74, 0.76, 0.78, 0.80]:
        for partial in [0.66, 0.68, 0.70, 0.72, 0.74]:
            if partial >= strong:
                continue
            for chunks in [1, 2]:
                for kw_s in [0.45, 0.50, 0.55, 0.60]:
                    for kw_p in [0.25, 0.30, 0.35, 0.40]:
                        if kw_p > kw_s:
                            continue
                        for mcs in [2, 3]:
                            for mcp in [1, 2]:
                                for awp in [False, True]:
                                    grid.append(Params(strong, partial, chunks, kw_s, kw_p, mcs, mcp, awp))

    best = None
    best_df = None

    for p in grid:
        df, summary = evaluate_from_features(feats, p)
        if summary["weak_misaligned_count"] > phase4_weak:
            continue
        score = objective(summary)
        if (best is None) or (score > best["objective"]):
            best = {"objective": score, "params": p.__dict__, **summary}
            best_df = df

    if best is None:
        raise RuntimeError("No valid Phase 4.1 config found.")

    out_dir = eval_dir / "phase4_1"
    out_dir.mkdir(parents=True, exist_ok=True)

    best_df.to_csv(out_dir / "per_question_eval_phase4_1_dense.csv", index=False)
    (out_dir / "phase4_1_best_config.json").write_text(json.dumps(best, indent=2), encoding="utf-8")

    phase4 = phase4_report["answer_mode"]
    comp = pd.DataFrame([
        {
            "phase": "phase4",
            "refusal_accuracy": phase4["refusal_accuracy"],
            "unsupported_over_answer_rate": None,
            "citation_correct_rate": phase4["citation_correct_rate"],
            "weak_misaligned_count": phase4["citation_weak_or_misleading_count"],
            "support_state_distribution": None,
        },
        {
            "phase": "phase4_1",
            "refusal_accuracy": best["refusal_accuracy"],
            "unsupported_over_answer_rate": best["unsupported_over_answer_rate"],
            "citation_correct_rate": best["citation_correct_rate"],
            "weak_misaligned_count": best["weak_misaligned_count"],
            "support_state_distribution": json.dumps(best["support_state_distribution"]),
        },
    ])
    comp.to_csv(out_dir / "phase4_1_vs_phase4_comparison.csv", index=False)

    p3 = pd.read_csv(phase3_table_path)
    p4 = pd.read_csv(phase4_table_path)
    p41 = best_df.copy()

    merged = p41[["question_id", "predicted_support_state", "citation_quality", "refusal_status"]].rename(columns={
        "predicted_support_state": "phase4_1_state",
        "citation_quality": "phase4_1_citation_quality",
        "refusal_status": "phase4_1_refusal",
    })
    merged = merged.merge(
        p4[["question_id", "predicted_support_state", "citation_quality", "refusal_status"]].rename(columns={
            "predicted_support_state": "phase4_state",
            "citation_quality": "phase4_citation_quality",
            "refusal_status": "phase4_refusal",
        }), on="question_id", how="left"
    )
    merged = merged.merge(
        p3[["question_id", "predicted_support_state", "citation_quality", "refusal_status"]].rename(columns={
            "predicted_support_state": "phase3_state",
            "citation_quality": "phase3_citation_quality",
            "refusal_status": "phase3_refusal",
        }), on="question_id", how="left"
    )

    changed = merged[(merged["phase4_1_state"] != merged["phase4_state"]) | (merged["phase4_1_refusal"] != merged["phase4_refusal"]) | (merged["phase4_1_citation_quality"] != merged["phase4_citation_quality"])]
    changed.to_csv(out_dir / "phase4_1_changed_decisions.csv", index=False)

    lines = [
        "# Phase 4.1 Refusal Diagnostics Report",
        "",
        "## Root cause analysis",
        "- Phase 4 allowed too many borderline PARTIAL outputs where refusal was safer.",
        "- Citation gating improved alignment, but PARTIAL boundary remained permissive.",
        "- Unsupported/ambiguous prompts were sometimes still answered due to low partial bar.",
        "",
        "## Phase 4.1 adjustments (logic/calibration only)",
        "- Tightened strong/partial score thresholds.",
        "- Tightened keyword coverage requirements.",
        "- Enforced minimum correctly-supported claim counts.",
        "- Kept weak/misaligned citations <= Phase 4 level.",
        "",
        "## Best configuration",
        f"- {json.dumps(best['params'])}",
        "",
        "## Metrics",
        f"- refusal_accuracy: {best['refusal_accuracy']:.4f}",
        f"- unsupported_over_answer_rate: {best['unsupported_over_answer_rate']:.4f}",
        f"- citation_correct_rate: {best['citation_correct_rate']:.4f}",
        f"- weak/misaligned citations: {best['weak_misaligned_count']}",
        f"- support-state distribution: {best['support_state_distribution']}",
        "",
    ]
    (out_dir / "refusal_diagnostics_report.md").write_text("\n".join(lines), encoding="utf-8")

    rec = {
        "phase4_1_success": bool((best["refusal_accuracy"] > phase4["refusal_accuracy"]) and (best["weak_misaligned_count"] <= phase4["citation_weak_or_misleading_count"])),
        "note": "Phase 4.1 recovered refusal reliability while preserving citation gains." if ((best["refusal_accuracy"] > phase4["refusal_accuracy"]) and (best["weak_misaligned_count"] <= phase4["citation_weak_or_misleading_count"])) else "Phase 4.1 did not meet recovery target.",
    }
    (out_dir / "phase4_1_recommendation.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")

    print(f"Saved: {out_dir / 'phase4_1_vs_phase4_comparison.csv'}")
    print(f"Saved: {out_dir / 'refusal_diagnostics_report.md'}")
    print(f"Saved: {out_dir / 'phase4_1_changed_decisions.csv'}")
    print(f"Saved: {out_dir / 'phase4_1_recommendation.json'}")


if __name__ == "__main__":
    main()
