import argparse
import pickle
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import CrossEncoder, SentenceTransformer

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


STOPWORDS = {
    "the", "and", "for", "from", "with", "that", "this", "what", "when", "where", "which", "into", "your", "my",
    "notes", "materials", "course", "using", "about", "over", "under", "than", "then", "into", "give", "summarise",
    "summarize", "explain", "compare", "list", "main", "key", "steps", "definition", "means", "does", "how", "why",
}


DENSE_THRESHOLDS = {
    "strong_score": 0.70,
    "partial_score": 0.65,
    "strong_chunks": 1,
    "kw_supported": 0.40,
    "kw_partial": 0.20,
}

HYBRID_THRESHOLDS = {
    "strong_score": 0.70,
    "partial_score": 0.50,
    "strong_chunks": 1,
    "kw_supported": 0.40,
    "kw_partial": 0.20,
}


QUERY_CONSTRAINT_HINTS = {
    "module", "week", "lecture", "chapter", "unit", "file", "source", "slide", "slides", "pdf", "ppt", "pptx"
}


def tokenize(text: str):
    return re.findall(r"[a-zA-Z0-9_]+", (text or "").lower())


def content_tokens(text: str):
    return [t for t in tokenize(text) if len(t) > 2 and t not in STOPWORDS]


def minmax_norm(arr: np.ndarray):
    if len(arr) == 0:
        return arr
    lo, hi = float(arr.min()), float(arr.max())
    if hi - lo < 1e-12:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)


def jaccard_token_similarity(a: str, b: str) -> float:
    ta = set(content_tokens(a))
    tb = set(content_tokens(b))
    if not ta or not tb:
        return 0.0
    return len(ta.intersection(tb)) / max(1, len(ta.union(tb)))


def parse_query_constraints(query: str):
    q = (query or "").lower()
    q_tokens = set(tokenize(q))
    has_constraint_hint = bool(q_tokens.intersection(QUERY_CONSTRAINT_HINTS))

    module_matches = re.findall(r"\bmodule\s*([0-9]{1,2}|[a-z])\b", q)
    week_matches = re.findall(r"\bweek\s*([0-9]{1,2})\b", q)

    file_hint_match = re.search(r"\b(?:file|source|from)\s*[:\-]?\s*([a-z0-9_\-\. ]{3,80})", q)
    file_hint = file_hint_match.group(1).strip() if file_hint_match else None

    should_filter = bool(has_constraint_hint and (module_matches or week_matches or file_hint))
    return {
        "should_filter": should_filter,
        "module_terms": {f"module {m}" for m in module_matches},
        "week_terms": {f"week {w}" for w in week_matches},
        "file_hint": file_hint,
    }


def citation(row) -> str:
    loc = "Slide" if str(row.unit_type).lower() == "slide" else "Page"
    return f"[Module: {row.module_name} | File: {row.file_name} | {loc}: {row.page_or_slide}]"


def split_sentences(text: str):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sents = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sents if s.strip()]


def keyword_overlap_score(query: str, sentence: str) -> int:
    q_tokens = set(content_tokens(query))
    s_tokens = set(content_tokens(sentence))
    return len(q_tokens.intersection(s_tokens))


def sentence_quality_ok(sentence: str) -> bool:
    s = sentence.strip()
    if len(s) < 40:
        return False
    if re.search(r"https?://", s):
        return False
    if len(content_tokens(s)) < 6:
        return False
    return True


def keyword_coverage(query: str, texts: List[str]):
    q = set(content_tokens(query))
    if not q:
        return None
    merged = set(content_tokens(" ".join(texts)))
    return len(q.intersection(merged)) / max(1, len(q))


def citation_support_label(claim: str, chunk_text: str):
    ct = set(content_tokens(claim))
    st = set(content_tokens(chunk_text))
    if not ct:
        return "weak", 0.0
    overlap = len(ct.intersection(st)) / max(1, len(ct))
    if overlap >= 0.45:
        return "correct", overlap
    if overlap >= 0.25:
        return "weak", overlap
    return "misleading", overlap


class Retriever:
    def __init__(
        self,
        use_hybrid=False,
        alpha=0.65,
        enable_rerank=False,
        reranker_model_name=None,
        retrieve_pool_k=20,
        enable_dedup=False,
        dedup_similarity_threshold=0.85,
        source_diversity_cap=2,
        enable_metadata_filter=False,
    ):
        self.use_hybrid = use_hybrid
        self.alpha = alpha
        self.enable_rerank = enable_rerank
        self.retrieve_pool_k = max(1, int(retrieve_pool_k))
        self.enable_dedup = enable_dedup
        self.dedup_similarity_threshold = dedup_similarity_threshold
        self.source_diversity_cap = max(1, int(source_diversity_cap))
        self.enable_metadata_filter = enable_metadata_filter

        self.index = faiss.read_index(str(config.INDEX_DIR / "faiss.index"))
        self.meta = pd.read_parquet(config.INDEX_DIR / "metadata.parquet")
        with (config.INDEX_DIR / "index_meta.pkl").open("rb") as f:
            im = pickle.load(f)
        self.model = SentenceTransformer(im["embedding_model"])

        self.bm25 = None
        if self.use_hybrid:
            with (config.INDEX_DIR / "bm25.pkl").open("rb") as f:
                self.bm25 = pickle.load(f)["bm25"]

        self.reranker = None
        if self.enable_rerank:
            model_name = reranker_model_name or getattr(config, "RERANKER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2")
            self.reranker = CrossEncoder(model_name)

    def _base_dense_candidates(self, q_vec: np.ndarray, k: int):
        scores, idxs = self.index.search(q_vec, k)
        return [(float(s), self.meta.iloc[int(i)]) for s, i in zip(scores[0], idxs[0]) if int(i) >= 0]

    def _base_hybrid_candidates(self, query: str, q_vec: np.ndarray, k: int):
        all_k = len(self.meta)
        d_scores, d_idxs = self.index.search(q_vec, all_k)
        dense_scores = np.zeros(all_k, dtype=np.float32)
        dense_scores[np.array(d_idxs[0], dtype=int)] = d_scores[0]

        b_scores = np.array(self.bm25.get_scores(tokenize(query)), dtype=np.float32)
        fused = self.alpha * minmax_norm(dense_scores) + (1.0 - self.alpha) * minmax_norm(b_scores)
        top_idx = np.argsort(-fused)[:k]
        return [(float(fused[i]), self.meta.iloc[int(i)]) for i in top_idx]

    def _apply_metadata_filter(self, query: str, candidates):
        if not candidates:
            return candidates
        constraints = parse_query_constraints(query)
        if not constraints["should_filter"]:
            return candidates

        module_terms = constraints["module_terms"].union(constraints["week_terms"])
        file_hint = constraints["file_hint"]

        filtered = []
        fallback = []
        for score, row in candidates:
            module_text = str(getattr(row, "module_name", "")).lower()
            file_text = str(getattr(row, "file_name", "")).lower()
            matched = False
            if module_terms and any(t in module_text for t in module_terms):
                matched = True
            if file_hint and file_hint.lower() in file_text:
                matched = True

            if matched:
                filtered.append((score, row))
            else:
                fallback.append((score, row))

        return filtered if filtered else candidates

    def _dedup_and_diversify(self, candidates, k: int):
        if not candidates:
            return []

        deduped = []
        for score, row in candidates:
            text = str(getattr(row, "chunk_text", ""))
            is_dup = False
            for _, seen_row in deduped:
                seen_text = str(getattr(seen_row, "chunk_text", ""))
                if jaccard_token_similarity(text, seen_text) >= self.dedup_similarity_threshold:
                    is_dup = True
                    break
            if not is_dup:
                deduped.append((score, row))

        selected = []
        source_counts = {}
        leftovers = []

        for score, row in deduped:
            source_key = (str(getattr(row, "module_name", "")), str(getattr(row, "file_name", "")))
            if source_counts.get(source_key, 0) < self.source_diversity_cap:
                selected.append((score, row))
                source_counts[source_key] = source_counts.get(source_key, 0) + 1
            else:
                leftovers.append((score, row))

        for item in leftovers:
            if len(selected) >= k:
                break
            selected.append(item)

        return selected[:k]

    def _rerank(self, query: str, candidates):
        if not candidates or self.reranker is None:
            return candidates
        pairs = [(query, str(row.chunk_text)) for _, row in candidates]
        rr_scores = self.reranker.predict(pairs)
        ranked = sorted(
            [(float(rr), row) for rr, (_, row) in zip(rr_scores, candidates)],
            key=lambda x: x[0],
            reverse=True,
        )
        return ranked

    def search(self, query: str, k: int):
        q = self.model.encode([query], normalize_embeddings=True)
        q = np.array(q, dtype="float32")

        pool_k = max(k, self.retrieve_pool_k)
        if self.use_hybrid:
            candidates = self._base_hybrid_candidates(query, q, pool_k)
        else:
            candidates = self._base_dense_candidates(q, pool_k)

        if self.enable_metadata_filter:
            candidates = self._apply_metadata_filter(query, candidates)

        if self.enable_rerank:
            candidates = self._rerank(query, candidates)

        if self.enable_dedup:
            return self._dedup_and_diversify(candidates, k)

        return candidates[:k]


def thresholds(use_hybrid: bool):
    return HYBRID_THRESHOLDS if use_hybrid else DENSE_THRESHOLDS


def support_state(query: str, retrieved, use_hybrid=False):
    th = thresholds(use_hybrid)
    scores = [s for s, _ in retrieved]
    top_score = scores[0] if scores else 0.0
    strong_count = sum(1 for s in scores if s >= th["strong_score"])
    kw_cov = keyword_coverage(query, [str(r.chunk_text) for _, r in retrieved])

    kw_sup_ok = (kw_cov is None) or (kw_cov >= th["kw_supported"])
    kw_par_ok = (kw_cov is None) or (kw_cov >= th["kw_partial"])

    if strong_count >= th["strong_chunks"] and top_score >= th["strong_score"] and kw_sup_ok:
        return "SUPPORTED", kw_cov
    if top_score >= th["partial_score"] and kw_par_ok:
        return "PARTIAL", kw_cov
    return "INSUFFICIENT", kw_cov


def pick_evidence_claims(query: str, retrieved, max_claims=4):
    picked = []
    for score, row in retrieved[:8]:
        sents = split_sentences(str(row.chunk_text))
        ranked = sorted(
            ((keyword_overlap_score(query, s), s) for s in sents if sentence_quality_ok(s)),
            key=lambda x: x[0],
            reverse=True,
        )
        if ranked:
            best = ranked[0][1]
            picked.append({
                "claim": best,
                "citation": citation(row),
                "chunk_text": str(row.chunk_text),
                "score": score,
                "module": str(row.module_name),
                "file": str(row.file_name),
                "page_or_slide": int(row.page_or_slide),
            })

    uniq = []
    seen = set()
    for x in picked:
        k = x["claim"][:160].lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(x)
        if len(uniq) >= max_claims:
            break
    return uniq


def validate_claims(claim_rows):
    labels = []
    for r in claim_rows:
        lbl, ov = citation_support_label(r["claim"], r["chunk_text"])
        r["citation_support"] = lbl
        r["support_overlap"] = ov
        labels.append(lbl)

    if not labels:
        overall = "misleading"
    elif any(l == "misleading" for l in labels):
        overall = "misleading"
    elif any(l == "weak" for l in labels):
        overall = "weak"
    else:
        overall = "correct"

    return claim_rows, overall


def generate_response(query: str, retrieved, mode="answer", use_hybrid=False):
    state, kw_cov = support_state(query, retrieved, use_hybrid=use_hybrid)

    if state == "INSUFFICIENT":
        return {
            "support_state": "INSUFFICIENT",
            "response_text": "Not enough evidence in the provided course materials to answer this reliably.",
            "citation_quality": "misleading",
            "claims": [],
            "kw_coverage": kw_cov,
        }

    max_claims = 3 if mode == "summary" else 4
    claims = pick_evidence_claims(query, retrieved, max_claims=max_claims)
    claims, citation_quality = validate_claims(claims)

    if not claims:
        return {
            "support_state": "INSUFFICIENT",
            "response_text": "Not enough evidence in the provided course materials to answer this reliably.",
            "citation_quality": "misleading",
            "claims": [],
            "kw_coverage": kw_cov,
        }

    # Citation-support validation gate (trustworthiness-first)
    if citation_quality == "misleading":
        return {
            "support_state": "INSUFFICIENT",
            "response_text": "Not enough evidence in the provided course materials to answer this reliably.",
            "citation_quality": citation_quality,
            "claims": claims,
            "kw_coverage": kw_cov,
        }

    correct_claims = sum(1 for c in claims if c.get("citation_support") == "correct")

    # If evidence is only weakly supported by citations, do not overstate confidence
    if citation_quality == "weak" and state == "SUPPORTED":
        state = "PARTIAL"

    # Partial state must still have at least two directly supported claims
    if state == "PARTIAL" and correct_claims < 2:
        return {
            "support_state": "INSUFFICIENT",
            "response_text": "Not enough evidence in the provided course materials to answer this reliably.",
            "citation_quality": citation_quality,
            "claims": claims,
            "kw_coverage": kw_cov,
        }

    if state == "SUPPORTED" and correct_claims < 2:
        state = "PARTIAL"

    lines = []
    if mode == "summary":
        lines.append("Grounded summary (course materials only):")
    else:
        lines.append("Grounded answer (course materials only):")

    lines.append(f"Support-State: {state}")
    if state == "PARTIAL":
        lines.append("Note: This response is based on incomplete evidence in the retrieved course materials.")

    lines.append("Key points:")
    for r in claims:
        lines.append(f"- {r['claim']} {r['citation']}")

    lines.append("Sources used:")
    seen_sources = set()
    for r in claims:
        src = r["citation"]
        if src in seen_sources:
            continue
        seen_sources.add(src)
        lines.append(f"- {src}")

    return {
        "support_state": state,
        "response_text": "\n".join(lines),
        "citation_quality": citation_quality,
        "claims": claims,
        "kw_coverage": kw_cov,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--k", type=int, default=config.TOP_K)
    parser.add_argument("--hybrid", action="store_true")
    parser.add_argument("--alpha", type=float, default=0.65)
    parser.add_argument("--mode", choices=["answer", "summary"], default="answer")
    parser.add_argument("--rerank", action="store_true")
    parser.add_argument("--retrieve-pool-k", type=int, default=20)
    parser.add_argument("--dedup", action="store_true")
    parser.add_argument("--metadata-filter", action="store_true")
    args = parser.parse_args()

    retriever = Retriever(
        use_hybrid=args.hybrid,
        alpha=args.alpha,
        enable_rerank=args.rerank,
        retrieve_pool_k=args.retrieve_pool_k,
        enable_dedup=args.dedup,
        enable_metadata_filter=args.metadata_filter,
    )
    retrieved = retriever.search(args.query, args.k)
    out = generate_response(args.query, retrieved, mode=args.mode, use_hybrid=args.hybrid)

    mode_label = f"HYBRID(alpha={args.alpha})" if args.hybrid else "DENSE"
    print(f"\nMode: {mode_label}")
    print(f"Query-Mode: {args.mode.upper()}\n")
    print(out["response_text"] + "\n")
    print(f"Citation support quality: {out['citation_quality']}")
    print("Top retrieved evidence:")
    for score, row in retrieved:
        print(f"- score={score:.4f} {citation(row)}")


if __name__ == "__main__":
    main()
