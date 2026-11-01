import json
import sys
from pathlib import Path

import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import answer  # noqa: E402


def eval_answer_quality(expected_support_type: str, predicted_state: str):
    e = expected_support_type.lower()
    if e == "supported":
        return "correct" if predicted_state == "SUPPORTED" else ("partly_correct" if predicted_state == "PARTIAL" else "incorrect")
    if e == "partial":
        return "partly_correct" if predicted_state in {"SUPPORTED", "PARTIAL"} else "incorrect"
    return "correct" if predicted_state == "INSUFFICIENT" else "incorrect"


def eval_refusal_status(expected_support_type: str, predicted_state: str):
    e = expected_support_type.lower()
    if e == "unsupported":
        return "refusal_correct" if predicted_state == "INSUFFICIENT" else "refusal_incorrect"
    return "refusal_correct" if predicted_state != "INSUFFICIENT" else "refusal_incorrect"


def evaluate_phase4(questions, mode="answer", use_hybrid=False, alpha=0.65):
    retriever = answer.Retriever(use_hybrid=use_hybrid, alpha=alpha)
    rows = []

    for q in questions:
        retrieved = retriever.search(q["question"], config.TOP_K)
        out = answer.generate_response(q["question"], retrieved, mode=mode, use_hybrid=use_hybrid)

        expected = q["expected_support_type"].upper()
        pred = out["support_state"]
        ans_q = eval_answer_quality(q["expected_support_type"], pred)
        refusal = eval_refusal_status(q["expected_support_type"], pred)

        retrieval_status = "retrieval_success" if ((expected in {"SUPPORTED", "PARTIAL"} and pred in {"SUPPORTED", "PARTIAL"}) or (expected == "UNSUPPORTED" and pred == "INSUFFICIENT")) else "retrieval_miss"

        rows.append({
            "question_id": q["question_id"],
            "question": q["question"],
            "question_type": q["question_type"],
            "expected_support_type": expected,
            "predicted_support_state": pred,
            "retrieval_status": retrieval_status,
            "answer_quality": ans_q,
            "citation_quality": out["citation_quality"],
            "refusal_status": refusal,
            "kw_coverage": out.get("kw_coverage"),
            "num_claims": len(out.get("claims", [])),
            "output_mode": mode,
            "output_text": out["response_text"],
        })

    return pd.DataFrame(rows)


def summarize(df: pd.DataFrame):
    return {
        "num_questions": int(len(df)),
        "retrieval_success_rate": float((df["retrieval_status"] == "retrieval_success").mean()),
        "answer_correct_rate": float((df["answer_quality"] == "correct").mean()),
        "answer_partly_correct_rate": float((df["answer_quality"] == "partly_correct").mean()),
        "citation_correct_rate": float((df["citation_quality"] == "correct").mean()),
        "citation_weak_or_misleading_count": int((df["citation_quality"] != "correct").sum()),
        "refusal_accuracy": float((df["refusal_status"] == "refusal_correct").mean()),
    }


def main():
    bench_path = config.EVAL_DIR / "benchmark_questions_v2_36.jsonl"
    phase3_dense_error = config.EVAL_DIR / "phase3" / "error_analysis_dense.json"

    questions = [json.loads(x) for x in bench_path.read_text(encoding="utf-8").splitlines() if x.strip()]

    out_dir = config.EVAL_DIR / "phase4"
    out_dir.mkdir(parents=True, exist_ok=True)

    # dense default evaluation (answer mode)
    df_dense = evaluate_phase4(questions, mode="answer", use_hybrid=False)
    df_dense.to_csv(out_dir / "per_question_eval_phase4_dense.csv", index=False)
    dense_summary = summarize(df_dense)

    # summary mode faithfulness eval on benchmark prompts
    df_summary = evaluate_phase4(questions, mode="summary", use_hybrid=False)
    df_summary.to_csv(out_dir / "summary_faithfulness_eval_dense.csv", index=False)
    summary_metrics = summarize(df_summary)

    # compare to phase3 baseline for citation weakness
    phase3 = json.loads(phase3_dense_error.read_text(encoding="utf-8")) if phase3_dense_error.exists() else {}
    phase3_weak = phase3.get("citation_weak_or_misleading", None)

    comparison = {
        "phase3_citation_weak_or_misleading_count": phase3_weak,
        "phase4_citation_weak_or_misleading_count": dense_summary["citation_weak_or_misleading_count"],
        "phase4_refusal_accuracy": dense_summary["refusal_accuracy"],
        "phase4_summary_refusal_accuracy": summary_metrics["refusal_accuracy"],
        "phase4_citation_correct_rate": dense_summary["citation_correct_rate"],
    }

    (out_dir / "citation_support_report.json").write_text(json.dumps({
        "answer_mode": dense_summary,
        "summary_mode": summary_metrics,
        "comparison_vs_phase3": comparison,
    }, indent=2), encoding="utf-8")

    # example outputs: supported / partial / insufficient
    ex_lines = ["# Phase 4 Output Examples", ""]
    for state in ["SUPPORTED", "PARTIAL", "INSUFFICIENT"]:
        sub = df_dense[df_dense["predicted_support_state"] == state]
        if len(sub) == 0:
            continue
        r = sub.iloc[0]
        ex_lines.append(f"## {state} example ({r['question_id']})")
        ex_lines.append(f"Question: {r['question']}")
        ex_lines.append("")
        ex_lines.append(r["output_text"])
        ex_lines.append("")

    (out_dir / "phase4_output_examples.md").write_text("\n".join(ex_lines), encoding="utf-8")

    # concise benchmark comparison table vs phase3
    comp_df = pd.DataFrame([
        {
            "phase": "phase3_dense_baseline",
            "citation_weak_or_misleading_count": phase3_weak,
            "refusal_accuracy": None,
            "citation_correct_rate": None,
        },
        {
            "phase": "phase4_dense",
            "citation_weak_or_misleading_count": dense_summary["citation_weak_or_misleading_count"],
            "refusal_accuracy": dense_summary["refusal_accuracy"],
            "citation_correct_rate": dense_summary["citation_correct_rate"],
        },
    ])
    comp_df.to_csv(out_dir / "phase4_vs_phase3_comparison.csv", index=False)

    # final recommendation note
    improved = None
    if phase3_weak is not None:
        improved = dense_summary["citation_weak_or_misleading_count"] < phase3_weak

    rec = {
        "phase4_improved_trustworthiness": bool(improved) if improved is not None else None,
        "recommendation": "Adopt Phase 4 output contract (support-state + citation validation + grounded summary mode) as default for dissertation demos." if improved is not False else "Keep Phase 4 cautiously; citation quality did not improve enough.",
    }
    (out_dir / "phase4_recommendation.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")

    print(f"Saved: {out_dir / 'per_question_eval_phase4_dense.csv'}")
    print(f"Saved: {out_dir / 'summary_faithfulness_eval_dense.csv'}")
    print(f"Saved: {out_dir / 'citation_support_report.json'}")
    print(f"Saved: {out_dir / 'phase4_vs_phase3_comparison.csv'}")
    print(f"Saved: {out_dir / 'phase4_output_examples.md'}")
    print(f"Saved: {out_dir / 'phase4_recommendation.json'}")


if __name__ == "__main__":
    main()
