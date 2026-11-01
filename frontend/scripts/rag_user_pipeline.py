import argparse
import json
import os
import re
from pathlib import Path
from typing import List, Dict

import numpy as np

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

try:
    from pptx import Presentation
except Exception:
    Presentation = None

from sentence_transformers import CrossEncoder, SentenceTransformer

TOKEN_RE = re.compile(r"\w+", re.UNICODE)
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_CONSTRAINT_HINTS = {"module", "week", "lecture", "chapter", "unit", "file", "source", "slide", "slides", "pdf", "ppt", "pptx"}


def token_count(text: str) -> int:
    return len(TOKEN_RE.findall(text or ""))


def infer_week(name: str):
    m = re.search(r"week\s*[-_ ]?0?(\d{1,2})", name or "", re.IGNORECASE)
    return int(m.group(1)) if m else None


def infer_module(filename: str):
    f = filename.lower()
    if "week" in f:
        w = infer_week(filename)
        if w is not None:
            return f"Week{w:02d}"
    if "reinforcement" in f or "learning" in f:
        return "AI Foundations"
    if "mapreduce" in f or "spark" in f or "big" in f:
        return "Big Data"
    if "cluster" in f or "text" in f:
        return "Intelligent Data and Text Analytics"
    if "viz" in f or "visual" in f:
        return "Data Visualisation"
    return "General"


def extract_pdf(path: Path, file_id: str, module: str):
    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) not installed")
    out = []
    doc = fitz.open(path)
    for i, page in enumerate(doc, start=1):
        txt = page.get_text("text") or ""
        if txt.strip():
            out.append({
                "chunk_id": f"{file_id}::page:{i}::c1",
                "file_id": file_id,
                "file_name": path.name,
                "module": module,
                "unit_type": "page",
                "page_or_slide": i,
                "inferred_week": infer_week(path.stem),
                "chunk_text": txt.strip(),
            })
    doc.close()
    return out


def extract_pptx(path: Path, file_id: str, module: str):
    if Presentation is None:
        raise RuntimeError("python-pptx not installed")
    out = []
    prs = Presentation(str(path))
    for i, slide in enumerate(prs.slides, start=1):
        lines = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text:
                t = shape.text.strip()
                if t:
                    lines.append(t)
        txt = "\n".join(lines).strip()
        if txt:
            out.append({
                "chunk_id": f"{file_id}::slide:{i}::c1",
                "file_id": file_id,
                "file_name": path.name,
                "module": module,
                "unit_type": "slide",
                "page_or_slide": i,
                "inferred_week": infer_week(path.stem),
                "chunk_text": txt,
            })
    return out


def extract_txt(path: Path, file_id: str, module: str):
    txt = path.read_text(encoding="utf-8", errors="ignore").strip()
    if not txt:
        return []
    return [{
        "chunk_id": f"{file_id}::page:1::c1",
        "file_id": file_id,
        "file_name": path.name,
        "module": module,
        "unit_type": "page",
        "page_or_slide": 1,
        "inferred_week": infer_week(path.stem),
        "chunk_text": txt,
    }]


def chunk_long(chunks: List[Dict], target=260, min_tokens=110):
    out = []
    for c in chunks:
        text = c["chunk_text"]
        if token_count(text) <= target:
            out.append(c)
            continue
        parts = re.split(r"(?<=[.!?])\s+", text)
        buf, buf_t, idx = [], 0, 1
        for s in parts:
            st = token_count(s)
            if buf_t + st > target and buf_t >= min_tokens:
                nc = dict(c)
                nc["chunk_id"] = f"{c['chunk_id']}::s{idx}"
                nc["chunk_text"] = " ".join(buf).strip()
                out.append(nc)
                buf, buf_t = [], 0
                idx += 1
            buf.append(s)
            buf_t += st
        if buf:
            nc = dict(c)
            nc["chunk_id"] = f"{c['chunk_id']}::s{idx}"
            nc["chunk_text"] = " ".join(buf).strip()
            out.append(nc)
    return out


def data_dir(user_id: str):
    return Path("data") / "user_rag" / user_id


def save_user_chunks(user_id: str, chunks: List[Dict]):
    ud = data_dir(user_id)
    ud.mkdir(parents=True, exist_ok=True)
    chunks_path = ud / "chunks.jsonl"

    existing = []
    if chunks_path.exists():
        existing = [json.loads(x) for x in chunks_path.read_text(encoding="utf-8").splitlines() if x.strip()]

    by_id = {c["chunk_id"]: c for c in existing}
    for c in chunks:
        by_id[c["chunk_id"]] = c

    merged = list(by_id.values())
    with chunks_path.open("w", encoding="utf-8") as f:
        for c in merged:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    return chunks_path, len(merged)


def build_embeddings(user_id: str):
    ud = data_dir(user_id)
    chunks_path = ud / "chunks.jsonl"
    chunks = [json.loads(x) for x in chunks_path.read_text(encoding="utf-8").splitlines() if x.strip()]
    texts = [c["chunk_text"] for c in chunks]

    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    emb = model.encode(texts, normalize_embeddings=True)
    np.save(ud / "embeddings.npy", np.array(emb, dtype=np.float32))
    (ud / "meta.json").write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    return len(chunks)


def ingest(user_id: str, file_path: str, file_id: str, file_name: str, module: str = None):
    p = Path(file_path)
    module_name = module or infer_module(file_name)
    ext = p.suffix.lower()

    if ext == ".pdf":
        units = extract_pdf(p, file_id, module_name)
    elif ext == ".pptx":
        units = extract_pptx(p, file_id, module_name)
    elif ext == ".txt":
        units = extract_txt(p, file_id, module_name)
    else:
        raise RuntimeError(f"Unsupported extension: {ext}")

    chunks = chunk_long(units)
    chunks_path, total = save_user_chunks(user_id, chunks)
    indexed = build_embeddings(user_id)

    return {
        "ok": True,
        "module": module_name,
        "units_extracted": len(units),
        "chunks_added": len(chunks),
        "chunks_total": total,
        "indexed_total": indexed,
        "chunks_path": str(chunks_path),
    }


def _tokens(text: str):
    return set((text or "").lower().split())


def _jaccard(a: str, b: str) -> float:
    ta = set(re.findall(r"[a-z0-9_]+", (a or "").lower()))
    tb = set(re.findall(r"[a-z0-9_]+", (b or "").lower()))
    if not ta or not tb:
        return 0.0
    return len(ta.intersection(tb)) / max(1, len(ta.union(tb)))


def _parse_query_constraints(query: str):
    q = (query or "").lower()
    q_tokens = set(re.findall(r"[a-z0-9_]+", q))
    has_hint = bool(q_tokens.intersection(_CONSTRAINT_HINTS))

    module_matches = re.findall(r"\bmodule\s*([0-9]{1,2}|[a-z])\b", q)
    week_matches = re.findall(r"\bweek\s*([0-9]{1,2})\b", q)
    file_hint_match = re.search(r"\b(?:file|source|from)\s*[:\-]?\s*([a-z0-9_\-\. ]{3,80})", q)

    should_filter = bool(has_hint and (module_matches or week_matches or file_hint_match))
    return {
        "should_filter": should_filter,
        "module_terms": {f"module {m}" for m in module_matches}.union({f"week {w}" for w in week_matches}),
        "file_hint": file_hint_match.group(1).strip().lower() if file_hint_match else None,
    }


def _metadata_filter(query: str, candidates: List[Dict]):
    constraints = _parse_query_constraints(query)
    if not constraints["should_filter"]:
        return candidates

    out = []
    for c in candidates:
        mod = str(c.get("module") or "").lower()
        fname = str(c.get("file") or "").lower()
        matched = False
        if constraints["module_terms"] and any(t in mod for t in constraints["module_terms"]):
            matched = True
        if constraints["file_hint"] and constraints["file_hint"] in fname:
            matched = True
        if matched:
            out.append(c)
    return out if out else candidates


def _dedup_and_diversify(candidates: List[Dict], k: int, dedup_threshold: float = 0.85, source_cap: int = 2):
    deduped = []
    for c in candidates:
        text = c.get("chunk_text", "")
        if any(_jaccard(text, x.get("chunk_text", "")) >= dedup_threshold for x in deduped):
            continue
        deduped.append(c)

    selected, leftovers = [], []
    source_counts = {}
    for c in deduped:
        key = (str(c.get("module") or ""), str(c.get("file") or ""))
        if source_counts.get(key, 0) < source_cap:
            selected.append(c)
            source_counts[key] = source_counts.get(key, 0) + 1
        else:
            leftovers.append(c)

    for c in leftovers:
        if len(selected) >= k:
            break
        selected.append(c)

    return selected[:k]


def retrieve(user_id: str, query: str, k: int = 5, retrieve_pool_k: int = 20, rerank: bool = True, dedup: bool = True, metadata_filter: bool = True):
    ud = data_dir(user_id)
    emb_path = ud / "embeddings.npy"
    meta_path = ud / "meta.json"
    if not emb_path.exists() or not meta_path.exists():
        return {"ok": True, "results": []}

    emb = np.load(emb_path)
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    model = SentenceTransformer("BAAI/bge-small-en-v1.5")
    q = model.encode([query], normalize_embeddings=True)[0]

    scores = emb @ q
    pool_k = max(k, retrieve_pool_k)
    idx = np.argsort(-scores)[:pool_k]

    candidates = []
    for i in idx:
        c = meta[int(i)]
        candidates.append({
            "score": float(scores[int(i)]),
            "file_id": c.get("file_id"),
            "module": c.get("module") or "General",
            "file": c.get("file_name"),
            "unit_type": c.get("unit_type"),
            "page_or_slide": c.get("page_or_slide"),
            "chunk_text": c.get("chunk_text", ""),
            "inferred_week": c.get("inferred_week"),
        })

    if metadata_filter:
        candidates = _metadata_filter(query, candidates)

    if rerank and candidates:
        reranker = CrossEncoder(RERANKER_MODEL)
        rr_scores = reranker.predict([(query, c.get("chunk_text", "")) for c in candidates])
        for c, rs in zip(candidates, rr_scores):
            c["score"] = float(rs)
        candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)

    if dedup:
        candidates = _dedup_and_diversify(candidates, k)
    else:
        candidates = candidates[:k]

    return {"ok": True, "results": candidates}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["ingest", "retrieve"], required=True)
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--file-path")
    ap.add_argument("--file-id")
    ap.add_argument("--file-name")
    ap.add_argument("--module")
    ap.add_argument("--query")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--retrieve-pool-k", type=int, default=20)
    ap.add_argument("--rerank", action="store_true")
    ap.add_argument("--dedup", action="store_true")
    ap.add_argument("--metadata-filter", action="store_true")
    args = ap.parse_args()

    if args.mode == "ingest":
        if not args.file_path or not args.file_id or not args.file_name:
            raise RuntimeError("ingest requires --file-path --file-id --file-name")
        out = ingest(args.user_id, args.file_path, args.file_id, args.file_name, args.module)
    else:
        if not args.query:
            raise RuntimeError("retrieve requires --query")
        out = retrieve(
            args.user_id,
            args.query,
            args.k,
            retrieve_pool_k=args.retrieve_pool_k,
            rerank=args.rerank,
            dedup=args.dedup,
            metadata_filter=args.metadata_filter,
        )

    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
