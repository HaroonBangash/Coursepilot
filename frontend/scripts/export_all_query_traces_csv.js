const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PYTHON_BIN = process.env.RAG_PYTHON_BIN || 'D:/Rag Project/.venv/Scripts/python.exe';
const PIPELINE = path.join(process.cwd(), 'scripts', 'rag_user_pipeline.py');
const STORE = path.join(process.cwd(), 'data', 'app-data.json');

function runPipeline(args) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON_BIN, [PIPELINE, ...args], { cwd: process.cwd(), timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '{}';
        resolve(JSON.parse(line));
      } catch {
        reject(new Error('Invalid pipeline output'));
      }
    });
  });
}

function esc(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

(async () => {
  const db = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  const questions = Array.isArray(db.questions) ? db.questions : [];
  if (!questions.length) throw new Error('No questions found in app-data.json');

  // Use the user with most questions (likely active frontend user)
  const counts = new Map();
  for (const q of questions) counts.set(q.userId, (counts.get(q.userId) || 0) + 1);
  const targetUserId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const userQuestions = questions.filter(q => q.userId === targetUserId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const rows = [];

  for (const q of userQuestions) {
    const retrieval = await runPipeline([
      '--mode', 'retrieve',
      '--user-id', q.userId,
      '--query', q.query,
      '--k', '8',
      '--retrieve-pool-k', '20',
      '--rerank',
      '--dedup',
      '--metadata-filter',
    ]);

    const chunks = retrieval.results || [];
    if (!chunks.length) {
      rows.push({
        created_at: q.createdAt,
        user_id: q.userId,
        question_id: q.id,
        query: q.query,
        mode: q.mode,
        support_state: q.supportState,
        llm_answer: q.answer,
        citation_count: (q.citations || []).length,
        chunk_rank: '',
        chunk_score: '',
        module: '',
        file: '',
        unit_type: '',
        page_or_slide: '',
        chunk_text: '',
      });
      continue;
    }

    chunks.forEach((c, idx) => {
      rows.push({
        created_at: q.createdAt,
        user_id: q.userId,
        question_id: q.id,
        query: q.query,
        mode: q.mode,
        support_state: q.supportState,
        llm_answer: q.answer,
        citation_count: (q.citations || []).length,
        chunk_rank: idx + 1,
        chunk_score: c.score,
        module: c.module || '',
        file: c.file || '',
        unit_type: c.unit_type || '',
        page_or_slide: c.page_or_slide || '',
        chunk_text: c.chunk_text || '',
      });
    });
  }

  const outDir = 'D:/Rag Project/data/eval/dissertation_pitch_pack/query_traces';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'all_queries_chunks_and_llm.csv');

  const headers = Object.keys(rows[0]);
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
  fs.writeFileSync(outPath, csv, 'utf-8');

  console.log(JSON.stringify({ ok: true, outPath, userId: targetUserId, questionCount: userQuestions.length, rowCount: rows.length }, null, 2));
})();