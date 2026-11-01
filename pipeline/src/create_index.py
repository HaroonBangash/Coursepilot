import json
import pickle
import re
import sys
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402


def tokenize(text: str):
    return re.findall(r"[a-zA-Z0-9_]+", (text or "").lower())


def main():
    inp = config.CHUNKS_DIR / "chunks.jsonl"
    index_path = config.INDEX_DIR / "faiss.index"
    meta_path = config.INDEX_DIR / "metadata.parquet"
    bm25_path = config.INDEX_DIR / "bm25.pkl"
    config.INDEX_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    texts = []
    with inp.open("r", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            rows.append(row)
            texts.append(row["chunk_text"])

    # Dense index
    model = SentenceTransformer(config.EMBEDDING_MODEL_NAME)
    emb = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    emb = np.array(emb, dtype="float32")

    index = faiss.IndexFlatIP(emb.shape[1])
    index.add(emb)
    faiss.write_index(index, str(index_path))

    # Metadata
    pd.DataFrame(rows).to_parquet(meta_path, index=False)

    # BM25 lexical index (for hybrid retrieval)
    tokenized_corpus = [tokenize(t) for t in texts]
    bm25 = BM25Okapi(tokenized_corpus)
    with bm25_path.open("wb") as f:
        pickle.dump({"bm25": bm25, "tokenized_corpus": tokenized_corpus}, f)

    with (config.INDEX_DIR / "index_meta.pkl").open("wb") as f:
        pickle.dump({"embedding_model": config.EMBEDDING_MODEL_NAME}, f)

    print(f"Saved: {index_path}")
    print(f"Saved: {meta_path}")
    print(f"Saved: {bm25_path}")
    print(f"Indexed chunks: {len(rows)}")


if __name__ == "__main__":
    main()
