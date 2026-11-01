import argparse
import json
import pickle
import re
import sys
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
    loc = "Slide" if row.unit_type == "slide" else "Page"
    return f"[Module: {row.module_name} | File: {row.file_name} | {loc}: {row.page_or_slide}]"


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


def min_score_for_mode(mode: str) -> float:
    return config.HYBRID_MIN_RETRIEVAL_SCORE if mode == "hybrid" else config.DENSE_MIN_RETRIEVAL_SCORE


def build_answer_like_decision(retrieved, mode: str):
    threshold = min_score_for_mode(mode)
    strong = [s for s, _ in retrieved if s >= threshold]
    return len(strong) >= config.MIN_STRONG_EVIDENCE_CHUNKS


def keyword_coverage(texts, expected_keywords):
    if not expected_keywords:
        return None
    merged = " ".join(texts).lower()
    found = sum(1 for k in expected_keywords if k.lower() in merged)
    return found / max(1, len(expected_keywords))


def module_hit(retrieved, expected_modules):
    if not expected_modules:
        return None
    mods = {r.module_name for _, r in retrieved}
    return int(any(m in mods for m in expected_modules))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["dense", "hybrid"], default="dense")
    parser.add_argument("--alpha", type=float, default=0.65)
    args = parser.parse_args()

    benchmark_path = config.EVAL_DIR / "benchmark_questions.jsonl"
    retrieval_out = config.EVAL_DIR / f"retrieval_results_{args.mode}.jsonl"
    summary_out = config.EVAL_DIR / f"metrics_summary_{args.mode}.json"

    if not benchmark_path.exists():
        raise FileNotFoundError(f"Benchmark file not found: {benchmark_path}")

    questions = []
    with benchmark_path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                questions.append(json.loads(line))

    retriever = EvalRetriever(mode=args.mode, alpha=args.alpha)

    rows = []
    for q in questions:
        retrieved = retriever.search(q["question"], config.TOP_K)
        predicted_supported = build_answer_like_decision(retrieved, mode=args.mode)

        texts = [str(r.chunk_text) for _, r in retrieved]
        kw_cov = keyword_coverage(texts, q.get("expected_keywords", []))
        mod_hit = module_hit(retrieved, q.get("expected_modules", []))

        gold_supported = bool(q.get("supported", True))
        refusal_correct = int((not predicted_supported) == (not gold_supported))

        rows.append({
            "qid": q["qid"],
            "question": q["question"],
            "type": q.get("type", "unknown"),
            "gold_supported": gold_supported,
            "pred_supported": predicted_supported,
            "refusal_correct": refusal_correct,
            "module_hit@k": mod_hit,
            "keyword_coverage@k": kw_cov,
            "top_score": retrieved[0][0] if retrieved else None,
            "top_citations": [citation(r) for _, r in retrieved[:3]],
        })

    with retrieval_out.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    df = pd.DataFrame(rows)
    summary = {
        "mode": args.mode,
        "alpha": args.alpha if args.mode == "hybrid" else None,
        "num_questions": int(len(df)),
        "supported_questions": int(df["gold_supported"].sum()),
        "unsupported_questions": int((~df["gold_supported"]).sum()),
        "refusal_quality_accuracy": float(df["refusal_correct"].mean()) if len(df) else None,
        "avg_top_score": float(df["top_score"].mean()) if len(df) else None,
        "module_hit_rate@k": float(df["module_hit@k"].dropna().mean()) if "module_hit@k" in df else None,
        "avg_keyword_coverage@k": float(df["keyword_coverage@k"].dropna().mean()) if "keyword_coverage@k" in df else None,
    }

    summary_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Saved: {retrieval_out}")
    print(f"Saved: {summary_out}")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
