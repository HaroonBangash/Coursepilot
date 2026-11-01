import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import answer  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--k", type=int, default=config.TOP_K)
    parser.add_argument("--hybrid", action="store_true", help="Use dense+BM25 fused retrieval")
    parser.add_argument("--alpha", type=float, default=0.65, help="Dense weight in hybrid fusion")

    parser.add_argument("--rerank", action="store_true", help="Apply cross-encoder reranking")
    parser.add_argument("--retrieve-pool-k", type=int, default=20, help="Candidate pool size before reranking")
    parser.add_argument("--dedup", action="store_true", help="Enable near-duplicate reduction + source diversity")
    parser.add_argument("--metadata-filter", action="store_true", help="Enable query-implied metadata filtering")

    args = parser.parse_args()

    retriever = answer.Retriever(
        use_hybrid=args.hybrid,
        alpha=args.alpha,
        enable_rerank=args.rerank,
        retrieve_pool_k=args.retrieve_pool_k,
        enable_dedup=args.dedup,
        enable_metadata_filter=args.metadata_filter,
    )

    results = retriever.search(args.query, args.k)

    mode_label = f"HYBRID(alpha={args.alpha})" if args.hybrid else "DENSE"
    hardening = []
    if args.rerank:
        hardening.append(f"rerank(pool={args.retrieve_pool_k})")
    if args.dedup:
        hardening.append("dedup+diversity")
    if args.metadata_filter:
        hardening.append("metadata-filter")

    print(f"Mode: {mode_label}")
    print(f"Hardening: {', '.join(hardening) if hardening else 'none'}")

    for score, row in results:
        cite = answer.citation(row)
        print(f"\nscore={score:.4f} {cite}\n{str(row.chunk_text)[:500]}\n")


if __name__ == "__main__":
    main()
