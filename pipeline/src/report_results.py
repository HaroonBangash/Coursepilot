import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def load_json(path: Path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def fmt(v):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.4f}"
    return str(v)


def main():
    dense = load_json(config.EVAL_DIR / "metrics_summary_dense.json")
    hybrid = load_json(config.EVAL_DIR / "metrics_summary_hybrid.json")

    out = config.EVAL_DIR / "report_results.md"

    lines = [
        "# RAG Evaluation Summary (Dissertation-ready)",
        "",
        "## Experimental Setup",
        "- Corpus: MSc course slides/notes from `D:\\Courses_Slides`",
        "- Retriever baseline: Dense embeddings (FAISS)",
        "- Retriever v2: Hybrid retrieval (Dense + BM25)",
        "- Grounding policy: answer only from retrieved evidence; refuse unsupported queries",
        "",
        "## Metrics Table",
        "",
        "| Metric | Dense | Hybrid |",
        "|---|---:|---:|",
        f"| Questions | {fmt(dense.get('num_questions') if dense else None)} | {fmt(hybrid.get('num_questions') if hybrid else None)} |",
        f"| Refusal quality accuracy | {fmt(dense.get('refusal_quality_accuracy') if dense else None)} | {fmt(hybrid.get('refusal_quality_accuracy') if hybrid else None)} |",
        f"| Module hit rate@k | {fmt(dense.get('module_hit_rate@k') if dense else None)} | {fmt(hybrid.get('module_hit_rate@k') if hybrid else None)} |",
        f"| Avg keyword coverage@k | {fmt(dense.get('avg_keyword_coverage@k') if dense else None)} | {fmt(hybrid.get('avg_keyword_coverage@k') if hybrid else None)} |",
        f"| Avg top score | {fmt(dense.get('avg_top_score') if dense else None)} | {fmt(hybrid.get('avg_top_score') if hybrid else None)} |",
        "",
        "## Interpretation Notes",
        "- Refusal quality checks whether unsupported queries are correctly rejected.",
        "- Module hit rate@k checks whether retrieval comes from expected module(s).",
        "- Keyword coverage@k is a lightweight relevance proxy and can be improved with reranking.",
        "",
        "## Next Improvements",
        "1. Add cross-encoder reranker for top-20 -> top-6 refinement.",
        "2. Expand benchmark to 30-50 questions across all modules.",
        "3. Add citation-level exactness scoring (page/slide precision).",
    ]

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
