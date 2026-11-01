import json
import re
from pathlib import Path

import numpy as np
import csv
from sentence_transformers import CrossEncoder, SentenceTransformer

from rag_user_pipeline import _metadata_filter, _dedup_and_diversify

ROOT = Path(__file__).resolve().parents[1]  # frontend
STORE = ROOT / 'data' / 'app-data.json'
OUT = Path('D:/Rag Project/data/eval/dissertation_pitch_pack/query_traces/all_frontend_questions_with_full_chunk_columns.csv')
USER_RAG_ROOT = ROOT / 'data' / 'user_rag'


def load_store():
    return json.loads(STORE.read_text(encoding='utf-8'))


def retrieve_for_query(user_id: str, query: str, emb_model, reranker, k=8, pool_k=20):
    ud = USER_RAG_ROOT / user_id
    emb_path = ud / 'embeddings.npy'
    meta_path = ud / 'meta.json'
    if not emb_path.exists() or not meta_path.exists():
        return []

    emb = np.load(emb_path)
    meta = json.loads(meta_path.read_text(encoding='utf-8'))

    qv = emb_model.encode([query], normalize_embeddings=True)[0]
    scores = emb @ qv
    idx = np.argsort(-scores)[: max(k, pool_k)]

    candidates = []
    for i in idx:
        c = meta[int(i)]
        candidates.append({
            'score': float(scores[int(i)]),
            'module': c.get('module') or 'General',
            'file': c.get('file_name') or '',
            'unit_type': c.get('unit_type') or '',
            'page_or_slide': c.get('page_or_slide') or '',
            'chunk_text': c.get('chunk_text') or '',
        })

    candidates = _metadata_filter(query, candidates)

    if candidates:
        rr_scores = reranker.predict([(query, c.get('chunk_text', '')) for c in candidates])
        for c, rs in zip(candidates, rr_scores):
            c['score'] = float(rs)
        candidates = sorted(candidates, key=lambda x: x['score'], reverse=True)

    candidates = _dedup_and_diversify(candidates, k)
    return candidates


def _clean_text(x):
    s = str(x or '')
    s = s.encode('utf-8', 'ignore').decode('utf-8', 'ignore')
    return s


def main():
    db = load_store()
    questions = db.get('questions', [])

    emb_model = SentenceTransformer('BAAI/bge-small-en-v1.5')
    reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

    rows = []
    for q in questions:
        query = _clean_text(q.get('query', ''))
        user_id = _clean_text(q.get('userId', ''))
        chunks = retrieve_for_query(user_id, query, emb_model, reranker, k=8, pool_k=20)

        row = {
            'createdAt': _clean_text(q.get('createdAt', '')),
            'userId': user_id,
            'id': _clean_text(q.get('id', '')),
            'query': query,
            'mode': _clean_text(q.get('mode', '')),
            'supportState': _clean_text(q.get('supportState', '')),
            'answer': _clean_text(q.get('answer', '')),
        }

        for i in range(8):
            c = chunks[i] if i < len(chunks) else {}
            j = i + 1
            row[f'chunk_score_{j}'] = c.get('score', '')
            row[f'chunk_module_{j}'] = _clean_text(c.get('module', ''))
            row[f'chunk_file_{j}'] = _clean_text(c.get('file', ''))
            row[f'chunk_location_{j}'] = _clean_text(f"{c.get('unit_type','')} {c.get('page_or_slide','')}".strip())
            row[f'chunk_text_{j}'] = _clean_text(re.sub(r'\s+', ' ', str(c.get('chunk_text', '')).strip()))

        rows.append(row)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        OUT.write_text('', encoding='utf-8-sig')
        print(json.dumps({'ok': True, 'out': str(OUT), 'rows': 0}))
        return

    headers = list(rows[0].keys())
    with OUT.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        w.writerows(rows)

    print(json.dumps({'ok': True, 'out': str(OUT), 'rows': len(rows)}))


if __name__ == '__main__':
    main()
