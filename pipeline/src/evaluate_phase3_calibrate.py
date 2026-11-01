import json
import pickle
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def tokenize(text: str):
    return re.findall(r"[a-zA-Z0-9_]+", (text or "").lower())


def minmax_norm(arr: np.ndarray):
    if len(arr) == 0:
        return arr
    lo, hi = float(arr.min()), float(arr.max())
    if hi - lo < 1e-12:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)


def citation(row) -> str:
    loc = "Slide" if str(row.unit_type).lower() == "slide" else "Page"
    return f"[Module: {row.module_name} | File: {row.file_name} | {loc}: {row.page_or_slide}]"


def parse_citation_module(cite: str):
    m = re.search(r"\[Module:\s*(.*?)\s*\|\s*File:", cite or "")
    return m.group(1).strip() if m else None


class EvalRetriever:
    def __init__(self, mode="dense", alpha=0.65):
        self.mode = mode
        self.alpha = alpha
        self.index = faiss.read_index(str(config.INDEX_DIR / "faiss.index"))
        self.meta = pd.read_parquet(config.INDEX_DIR / "metadata.parquet")

        with (config.INDEX_DIR / "index_meta.pkl").open("rb") as f:
            im = pickle.load(f)
        self.model = SentenceTransformer(im["embedding_model"])

        self.bm25 = None
        if self.mode == "hybrid":
            with (config.INDEX_DIR / "bm25.pkl").open("rb") as f:
                self.bm25 = pickle.load(f)["bm25"]

    def search(self, query: str, k: int):
        q = self.model.encode([query], normalize_embeddings=True)
        q = np.array(q, dtype="float32")

        if self.mode == "dense":
            scores, idxs = self.index.search(q, k)
            return [(float(s), self.meta.iloc[int(i)]) for s, i in zip(scores[0], idxs[0])]

        all_k = len(self.meta)
        d_scores, d_idxs = self.index.search(q, all_k)
        dense_scores = np.zeros(all_k, dtype=np.float32)
        dense_scores[np.array(d_idxs[0], dtype=int)] = d_scores[0]

        b_scores = np.array(self.bm25.get_scores(tokenize(query)), dtype=np.float32)
        fused = self.alpha * minmax_norm(dense_scores) + (1.0 - self.alpha) * minmax_norm(b_scores)
        top_idx = np.argsort(-fused)[:k]
        return [(float(fused[i]), self.meta.iloc[int(i)]) for i in top_idx]


@dataclass
class Thresholds:
    strong_score: float
    partial_score: float
    strong_chunks: int
    kw_supported: float
    kw_partial: float


def keyword_coverage(texts: List[str], expected_keywords: List[str]):
    if not expected_keywords:
        return None
    merged = " ".join(texts).lower()
    found = sum(1 for k in expected_keywords if k.lower() in merged)
    return found / max(1, len(expected_keywords))


def support_state_from_retrieval(retrieved, kw_cov, th: Thresholds):
    scores = [s for s, _ in retrieved]
    top_score = scores[0] if scores else 0.0
    strong_count = sum(1 for s in scores if s >= th.strong_score)

    kw_for_supported = (kw_cov is None) or (kw_cov >= th.kw_supported)
    kw_for_partial = (kw_cov is None) or (kw_cov >= th.kw_partial)

    if strong_count >= th.strong_chunks and top_score >= th.strong_score and kw_for_supported:
        return "SUPPORTED"
    if top_score >= th.partial_score and kw_for_partial:
        return "PARTIAL"
    return "INSUFFICIENT"


def classify_answer_quality(expected_support_type: str, predicted_state: str) -> str:
    e = expected_support_type.lower()
    p = predicted_state

    if e == "supported":
        if p == "SUPPORTED":
            return "correct"
        if p == "PARTIAL":
            return "partly_correct"
        return "incorrect"

    if e == "partial":
        if p == "PARTIAL":
            return "partly_correct"
        if p == "SUPPORTED":
            return "partly_correct"
        return "incorrect"

    # unsupported
    return "correct" if p == "INSUFFICIENT" else "incorrect"


def classify_citation_quality(expected_modules: List[str], top_citations: List[str]) -> str:
    if not top_citations:
        return "misleading"

    top1_mod = parse_citation_module(top_citations[0])
    if expected_modules:
        return "correct" if top1_mod in set(expected_modules) else "weak"
    # unsupported questions: any citation is weak evidence context, not necessarily wrong format
    return "weak"


def evaluate_mode(questions: List[dict], mode: str, alpha: float, th: Thresholds):
    retriever = EvalRetriever(mode=mode, alpha=alpha)
    rows = []

    for q in questions:
        retrieved = retriever.search(q["question"], config.TOP_K)
        texts = [str(r.chunk_text) for _, r in retrieved]
        kw_cov = keyword_coverage(texts, q.get("expected_keywords", []))
        module_hit = int(any(r.module_name in set(q.get("expected_modules", [])) for _, r in retrieved)) if q.get("expected_modules") else None
        predicted_state = support_state_from_retrieval(retrieved, kw_cov, th)

        expected_support = q.get("expected_support_type", "supported").lower()
        retrieval_success = (
            (expected_support in {"supported", "partial"} and predicted_state in {"SUPPORTED", "PARTIAL"} and (module_hit in {1, None}))
            or (expected_support == "unsupported" and predicted_state == "INSUFFICIENT")
        )

        answer_quality = classify_answer_quality(expected_support, predicted_state)
        top_cits = [citation(r) for _, r in retrieved[:3]]
        citation_quality = classify_citation_quality(q.get("expected_modules", []), top_cits)

        refusal_correct = int((expected_support == "unsupported" and predicted_state == "INSUFFICIENT") or (expected_support != "unsupported" and predicted_state != "INSUFFICIENT"))

        rows.append({
            "question_id": q.get("question_id", q.get("qid")),
            "question": q["question"],
            "module_hint": q.get("module_hint"),
            "question_type": q.get("question_type", q.get("type")),
            "expected_support_type": expected_support.upper(),
            "predicted_support_state": predicted_state,
            "retrieval_status": "retrieval_success" if retrieval_success else "retrieval_miss",
            "answer_quality": answer_quality,
            "citation_quality": citation_quality,
            "refusal_status": "refusal_correct" if refusal_correct else "refusal_incorrect",
            "top_score": retrieved[0][0] if retrieved else None,
            "module_hit@k": module_hit,
            "keyword_coverage@k": kw_cov,
            "top_citations": top_cits,
        })

    df = pd.DataFrame(rows)

    # summary metrics
    retrieval_success_rate = float((df["retrieval_status"] == "retrieval_success").mean())
    answer_correct_rate = float((df["answer_quality"] == "correct").mean())
    answer_partly_rate = float((df["answer_quality"] == "partly_correct").mean())
    citation_correct_rate = float((df["citation_quality"] == "correct").mean())
    refusal_accuracy = float((df["refusal_status"] == "refusal_correct").mean())
    over_answer_rate = float(((df["expected_support_type"] == "UNSUPPORTED") & (df["predicted_support_state"] != "INSUFFICIENT")).mean())

    trust_score = (
        0.40 * refusal_accuracy
        + 0.20 * citation_correct_rate
        + 0.20 * answer_correct_rate
        + 0.10 * answer_partly_rate
        + 0.10 * retrieval_success_rate
        - 0.20 * over_answer_rate
    )

    summary = {
        "mode": mode,
        "alpha": alpha if mode == "hybrid" else None,
        "thresholds": th.__dict__,
        "num_questions": int(len(df)),
        "retrieval_success_rate": retrieval_success_rate,
        "answer_correct_rate": answer_correct_rate,
        "answer_partly_correct_rate": answer_partly_rate,
        "citation_correct_rate": citation_correct_rate,
        "refusal_accuracy": refusal_accuracy,
        "over_answer_rate_unsupported": over_answer_rate,
        "avg_top_score": float(df["top_score"].mean()),
        "avg_keyword_coverage@k": float(df["keyword_coverage@k"].dropna().mean()) if df["keyword_coverage@k"].notna().any() else None,
        "trust_score": float(trust_score),
    }
    return df, summary


def calibrate(questions: List[dict], mode: str, alpha: float):
    strong_grid = [0.70, 0.74, 0.78, 0.82]
    partial_grid = [0.50, 0.55, 0.60, 0.65]
    kw_s_grid = [0.40, 0.50, 0.60]
    kw_p_grid = [0.20, 0.30, 0.40]
    strong_chunks_grid = [1, 2, 3]

    best = None
    best_df = None

    for ss in strong_grid:
        for ps in partial_grid:
            if ps >= ss:
                continue
            for ks in kw_s_grid:
                for kp in kw_p_grid:
                    if kp > ks:
                        continue
                    for sc in strong_chunks_grid:
                        th = Thresholds(ss, ps, sc, ks, kp)
                        df, summary = evaluate_mode(questions, mode, alpha, th)
                        if (best is None) or (summary["trust_score"] > best["trust_score"]):
                            best = summary
                            best_df = df

    return best_df, best


def error_analysis(df: pd.DataFrame):
    fails = df[(df["answer_quality"] == "incorrect") | (df["refusal_status"] == "refusal_incorrect") | (df["citation_quality"] != "correct")]
    breakdown = {
        "total_questions": int(len(df)),
        "incorrect_answers": int((df["answer_quality"] == "incorrect").sum()),
        "partly_correct_answers": int((df["answer_quality"] == "partly_correct").sum()),
        "citation_weak_or_misleading": int((df["citation_quality"] != "correct").sum()),
        "refusal_incorrect": int((df["refusal_status"] == "refusal_incorrect").sum()),
        "retrieval_miss": int((df["retrieval_status"] == "retrieval_miss").sum()),
        "failure_by_question_type": df.groupby("question_type")["answer_quality"].apply(lambda s: int((s == "incorrect").sum())).to_dict(),
    }
    return fails, breakdown


def main():
    bench_path = config.EVAL_DIR / "benchmark_questions_v2_36.jsonl"
    if not bench_path.exists():
        raise FileNotFoundError(f"Missing benchmark: {bench_path}")

    questions = [json.loads(x) for x in bench_path.read_text(encoding="utf-8").splitlines() if x.strip()]

    out_dir = config.EVAL_DIR / "phase3"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Ensure index reflects default embedding model and phase1 chunks
    # (caller runs create_index before this script)

    dense_df, dense_summary = calibrate(questions, mode="dense", alpha=0.65)
    hybrid_df, hybrid_summary = calibrate(questions, mode="hybrid", alpha=0.65)

    dense_df.to_csv(out_dir / "per_question_eval_dense.csv", index=False)
    hybrid_df.to_csv(out_dir / "per_question_eval_hybrid.csv", index=False)

    (out_dir / "threshold_calibration_dense.json").write_text(json.dumps(dense_summary, indent=2), encoding="utf-8")
    (out_dir / "threshold_calibration_hybrid.json").write_text(json.dumps(hybrid_summary, indent=2), encoding="utf-8")

    # comparison
    comp = pd.DataFrame([dense_summary, hybrid_summary])
    comp.to_csv(out_dir / "dense_vs_hybrid_calibrated.csv", index=False)

    # error reports
    d_fails, d_break = error_analysis(dense_df)
    h_fails, h_break = error_analysis(hybrid_df)

    d_fails.to_csv(out_dir / "error_cases_dense.csv", index=False)
    h_fails.to_csv(out_dir / "error_cases_hybrid.csv", index=False)

    (out_dir / "error_analysis_dense.json").write_text(json.dumps(d_break, indent=2), encoding="utf-8")
    (out_dir / "error_analysis_hybrid.json").write_text(json.dumps(h_break, indent=2), encoding="utf-8")

    rec_mode = "dense" if dense_summary["trust_score"] >= hybrid_summary["trust_score"] else "hybrid"

    md = []
    md.append("# Phase 3 Threshold Calibration Report")
    md.append("")
    md.append("## Calibrated Comparison (Trustworthiness-first)")
    view_cols = [
        "mode", "trust_score", "refusal_accuracy", "over_answer_rate_unsupported",
        "citation_correct_rate", "answer_correct_rate", "answer_partly_correct_rate",
        "retrieval_success_rate", "avg_top_score", "avg_keyword_coverage@k"
    ]
    md.append("| " + " | ".join(view_cols) + " |")
    md.append("|" + "|".join(["---"] * len(view_cols)) + "|")
    for _, r in comp[view_cols].iterrows():
        md.append("| " + " | ".join(str(r[c]) for c in view_cols) + " |")
    md.append("")
    md.append(f"## Recommendation: **{rec_mode.upper()}**")
    md.append("- Selected by calibrated trust_score with refusal reliability priority.")
    md.append("")
    md.append("### Dense thresholds")
    md.append(f"- {dense_summary['thresholds']}")
    md.append("### Hybrid thresholds")
    md.append(f"- {hybrid_summary['thresholds']}")

    (out_dir / "threshold_calibration_report.md").write_text("\n".join(md), encoding="utf-8")

    print(f"Saved: {out_dir / 'per_question_eval_dense.csv'}")
    print(f"Saved: {out_dir / 'per_question_eval_hybrid.csv'}")
    print(f"Saved: {out_dir / 'dense_vs_hybrid_calibrated.csv'}")
    print(f"Saved: {out_dir / 'threshold_calibration_report.md'}")
    print(f"Recommended mode: {rec_mode}")


if __name__ == "__main__":
    main()
