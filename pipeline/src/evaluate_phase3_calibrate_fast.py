import json
import pickle
import re
import sys
from dataclasses import dataclass
from pathlib import Path

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


def keyword_coverage(texts, expected_keywords):
    if not expected_keywords:
        return None
    merged = " ".join(texts).lower()
    found = sum(1 for k in expected_keywords if k.lower() in merged)
    return found / max(1, len(expected_keywords))


class Retriever:
    def __init__(self, mode="dense", alpha=0.65):
        self.mode = mode
        self.alpha = alpha
        self.index = faiss.read_index(str(config.INDEX_DIR / "faiss.index"))
        self.meta = pd.read_parquet(config.INDEX_DIR / "metadata.parquet")
        with (config.INDEX_DIR / "index_meta.pkl").open("rb") as f:
            im = pickle.load(f)
        self.model = SentenceTransformer(im["embedding_model"])
        self.bm25 = None
        if mode == "hybrid":
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


def support_state(feat, th: Thresholds):
    strong_cnt = sum(1 for s in feat["scores"] if s >= th.strong_score)
    top_score = feat["top_score"]
    kw = feat["kw_cov"]
    kw_sup_ok = (kw is None) or (kw >= th.kw_supported)
    kw_par_ok = (kw is None) or (kw >= th.kw_partial)

    if strong_cnt >= th.strong_chunks and top_score >= th.strong_score and kw_sup_ok:
        return "SUPPORTED"
    if top_score >= th.partial_score and kw_par_ok:
        return "PARTIAL"
    return "INSUFFICIENT"


def answer_quality(expected, pred):
    e = expected.lower()
    if e == "supported":
        return "correct" if pred == "SUPPORTED" else ("partly_correct" if pred == "PARTIAL" else "incorrect")
    if e == "partial":
        return "partly_correct" if pred in {"SUPPORTED", "PARTIAL"} else "incorrect"
    return "correct" if pred == "INSUFFICIENT" else "incorrect"


def citation_quality(expected_modules, top_citations):
    if not top_citations:
        return "misleading"
    if not expected_modules:
        return "weak"
    top_mod = parse_citation_module(top_citations[0])
    return "correct" if top_mod in set(expected_modules) else "weak"


def build_features(questions, retriever: Retriever):
    feats = {}
    for q in questions:
        ret = retriever.search(q["question"], config.TOP_K)
        texts = [str(r.chunk_text) for _, r in ret]
        cits = [citation(r) for _, r in ret[:3]]
        feats[q["question_id"]] = {
            "qid": q["question_id"],
            "question": q["question"],
            "expected": q["expected_support_type"],
            "expected_modules": q.get("expected_modules", []),
            "question_type": q.get("question_type", q.get("type", "unknown")),
            "module_hint": q.get("module_hint"),
            "scores": [s for s, _ in ret],
            "top_score": ret[0][0] if ret else 0.0,
            "kw_cov": keyword_coverage(texts, q.get("expected_keywords", [])),
            "module_hit": int(any(r.module_name in set(q.get("expected_modules", [])) for _, r in ret)) if q.get("expected_modules") else None,
            "top_citations": cits,
        }
    return feats


def eval_thresholds(feats: dict, th: Thresholds):
    rows = []
    for _, f in feats.items():
        pred = support_state(f, th)
        expected = f["expected"].upper()
        a_q = answer_quality(f["expected"], pred)
        c_q = citation_quality(f["expected_modules"], f["top_citations"])
        retrieval_success = (
            (expected in {"SUPPORTED", "PARTIAL"} and pred in {"SUPPORTED", "PARTIAL"} and (f["module_hit"] in {1, None}))
            or (expected == "UNSUPPORTED" and pred == "INSUFFICIENT")
        )
        refusal_correct = (expected == "UNSUPPORTED" and pred == "INSUFFICIENT") or (expected != "UNSUPPORTED" and pred != "INSUFFICIENT")

        rows.append({
            "question_id": f["qid"],
            "question": f["question"],
            "module_hint": f["module_hint"],
            "question_type": f["question_type"],
            "expected_support_type": expected,
            "predicted_support_state": pred,
            "retrieval_status": "retrieval_success" if retrieval_success else "retrieval_miss",
            "answer_quality": a_q,
            "citation_quality": c_q,
            "refusal_status": "refusal_correct" if refusal_correct else "refusal_incorrect",
            "top_score": f["top_score"],
            "module_hit@k": f["module_hit"],
            "keyword_coverage@k": f["kw_cov"],
            "top_citations": f["top_citations"],
        })

    df = pd.DataFrame(rows)
    retrieval_success_rate = float((df["retrieval_status"] == "retrieval_success").mean())
    answer_correct_rate = float((df["answer_quality"] == "correct").mean())
    answer_partly_rate = float((df["answer_quality"] == "partly_correct").mean())
    citation_correct_rate = float((df["citation_quality"] == "correct").mean())
    refusal_accuracy = float((df["refusal_status"] == "refusal_correct").mean())
    over_answer_rate = float(((df["expected_support_type"] == "UNSUPPORTED") & (df["predicted_support_state"] != "INSUFFICIENT")).mean())

    trust_score = (
        0.45 * refusal_accuracy
        + 0.20 * citation_correct_rate
        + 0.15 * answer_correct_rate
        + 0.10 * answer_partly_rate
        + 0.10 * retrieval_success_rate
        - 0.25 * over_answer_rate
    )

    summary = {
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


def calibrate(feats: dict):
    strong_grid = [0.70, 0.74, 0.78, 0.82]
    partial_grid = [0.50, 0.55, 0.60, 0.65]
    kw_s_grid = [0.40, 0.50, 0.60]
    kw_p_grid = [0.20, 0.30, 0.40]
    strong_chunks_grid = [1, 2, 3]

    best_df, best_summary = None, None
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
                        df, sm = eval_thresholds(feats, th)
                        if (best_summary is None) or (sm["trust_score"] > best_summary["trust_score"]):
                            best_df, best_summary = df, sm
    return best_df, best_summary


def error_analysis(df: pd.DataFrame):
    fails = df[(df["answer_quality"] == "incorrect") | (df["citation_quality"] != "correct") | (df["refusal_status"] == "refusal_incorrect")]
    breakdown = {
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
    questions = [json.loads(x) for x in bench_path.read_text(encoding="utf-8").splitlines() if x.strip()]

    out_dir = config.EVAL_DIR / "phase3"
    out_dir.mkdir(parents=True, exist_ok=True)

    dense_feats = build_features(questions, Retriever(mode="dense", alpha=0.65))
    hybrid_feats = build_features(questions, Retriever(mode="hybrid", alpha=0.65))

    dense_df, dense_sm = calibrate(dense_feats)
    dense_sm["mode"] = "dense"
    dense_sm["alpha"] = None

    hybrid_df, hybrid_sm = calibrate(hybrid_feats)
    hybrid_sm["mode"] = "hybrid"
    hybrid_sm["alpha"] = 0.65

    dense_df.to_csv(out_dir / "per_question_eval_dense.csv", index=False)
    hybrid_df.to_csv(out_dir / "per_question_eval_hybrid.csv", index=False)

    (out_dir / "threshold_calibration_dense.json").write_text(json.dumps(dense_sm, indent=2), encoding="utf-8")
    (out_dir / "threshold_calibration_hybrid.json").write_text(json.dumps(hybrid_sm, indent=2), encoding="utf-8")

    comp = pd.DataFrame([dense_sm, hybrid_sm])
    comp.to_csv(out_dir / "dense_vs_hybrid_calibrated.csv", index=False)

    d_fails, d_break = error_analysis(dense_df)
    h_fails, h_break = error_analysis(hybrid_df)

    d_fails.to_csv(out_dir / "error_cases_dense.csv", index=False)
    h_fails.to_csv(out_dir / "error_cases_hybrid.csv", index=False)

    (out_dir / "error_analysis_dense.json").write_text(json.dumps(d_break, indent=2), encoding="utf-8")
    (out_dir / "error_analysis_hybrid.json").write_text(json.dumps(h_break, indent=2), encoding="utf-8")

    rec_mode = "dense" if dense_sm["trust_score"] >= hybrid_sm["trust_score"] else "hybrid"

    md = [
        "# Phase 3 Threshold Calibration Report",
        "",
        "## Dense vs Hybrid (calibrated)",
        "| mode | trust_score | refusal_accuracy | over_answer_rate_unsupported | citation_correct_rate | answer_correct_rate | answer_partly_correct_rate | retrieval_success_rate | avg_top_score | avg_keyword_coverage@k |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for _, r in comp.iterrows():
        md.append(f"| {r['mode']} | {r['trust_score']:.4f} | {r['refusal_accuracy']:.4f} | {r['over_answer_rate_unsupported']:.4f} | {r['citation_correct_rate']:.4f} | {r['answer_correct_rate']:.4f} | {r['answer_partly_correct_rate']:.4f} | {r['retrieval_success_rate']:.4f} | {r['avg_top_score']:.4f} | {r['avg_keyword_coverage@k']:.4f} |")

    md.extend([
        "",
        f"## Recommended mode: **{rec_mode.upper()}**",
        "",
        "### Dense safest thresholds",
        f"- {dense_sm['thresholds']}",
        "### Hybrid safest thresholds",
        f"- {hybrid_sm['thresholds']}",
    ])

    (out_dir / "threshold_calibration_report.md").write_text("\n".join(md), encoding="utf-8")
    print(f"Saved outputs to: {out_dir}")
    print(f"Recommended mode: {rec_mode}")


if __name__ == "__main__":
    main()
