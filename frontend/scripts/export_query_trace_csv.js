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

function csvEscape(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

(async () => {
  const queryArg = process.argv.slice(2).join(' ').trim().toLowerCase();
  const db = JSON.parse(fs.readFileSync(STORE, 'utf-8'));
  const questions = db.questions || [];

  let target = null;
  if (queryArg) {
    target = questions.find(q => String(q.query || '').toLowerCase().includes(queryArg));
  } else {
    target = questions[0] || null;
  }

  if (!target) throw new Error('No matching question found in app-data.json');

  const query = target.query;
  const userId = target.userId;

  const retrieval = await runPipeline([
    '--mode', 'retrieve',
    '--user-id', userId,
    '--query', query,
    '--k', '8',
    '--retrieve-pool-k', '20',
    '--rerank',
    '--dedup',
    '--metadata-filter',
  ]);

  const chunks = retrieval.results || [];

  const outRows = chunks.map((c, i) => ({
    rank: i + 1,
    score: c.score,
    query,
    support_state: target.supportState,
    llm_answer: target.answer,
    citation_count: (target.citations || []).length,
    module: c.module || '',
    file: c.file || '',
    unit_type: c.unit_type || '',
    page_or_slide: c.page_or_slide || '',
    chunk_text: c.chunk_text || '',
  }));

  const outDir = 'D:/Rag Project/data/eval/dissertation_pitch_pack/query_traces';
  fs.mkdirSync(outDir, { recursive: true });
  const safe = query.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
  const outPath = path.join(outDir, `trace_${safe || 'query'}.csv`);

  const headers = Object.keys(outRows[0] || {
    rank: '', score: '', query: '', support_state: '', llm_answer: '', citation_count: '',
    module: '', file: '', unit_type: '', page_or_slide: '', chunk_text: ''
  });
  const lines = [headers.join(',')];
  for (const r of outRows) lines.push(headers.map(h => csvEscape(r[h])).join(','));
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(JSON.stringify({ ok: true, outPath, query, userId, chunks: chunks.length }, null, 2));
})();