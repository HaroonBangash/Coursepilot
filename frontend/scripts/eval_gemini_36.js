const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3104';
const BENCH_PATH = 'D:/Rag Project/data/eval/benchmark_questions_v2_36.jsonl';
const SLIDES_DIR = 'D:/Courses_Slides';
const OUT_DIR = 'D:/Rag Project/data/eval/final';

let cookie = '';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(urlPath, opt = {}) {
  opt.headers = opt.headers || {};
  if (cookie) opt.headers.cookie = cookie;
  opt.redirect = 'manual';
  const r = await fetch(BASE + urlPath, opt);
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { status: r.status, text: t, json: j };
}

function walkFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function mimeFor(p) {
  const q = p.toLowerCase();
  if (q.endsWith('.pdf')) return 'application/pdf';
  if (q.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (q.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  return 'application/octet-stream';
}

function normalizeState(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'SUPPORTED' || v === 'PARTIAL' || v === 'INSUFFICIENT') return v;
  return 'INSUFFICIENT';
}

function classifyAnswerQuality(expected, predicted) {
  const e = String(expected || '').toLowerCase();
  if (e === 'supported') return predicted === 'SUPPORTED' ? 'correct' : (predicted === 'PARTIAL' ? 'partly_correct' : 'incorrect');
  if (e === 'partial') return (predicted === 'SUPPORTED' || predicted === 'PARTIAL') ? 'partly_correct' : 'incorrect';
  return predicted === 'INSUFFICIENT' ? 'correct' : 'incorrect';
}

function classifyRefusal(expected, predicted) {
  const e = String(expected || '').toLowerCase();
  if (e === 'unsupported') return predicted === 'INSUFFICIENT' ? 'refusal_correct' : 'refusal_incorrect';
  return predicted !== 'INSUFFICIENT' ? 'refusal_correct' : 'refusal_incorrect';
}

function classifyCitationQuality(expected, predicted, citations, moduleHint) {
  const cits = Array.isArray(citations) ? citations : [];
  const e = String(expected || '').toLowerCase();
  if (e === 'unsupported') return predicted === 'INSUFFICIENT' ? 'correct' : (cits.length ? 'weak' : 'correct');
  if (predicted === 'INSUFFICIENT') return 'correct';
  if (!cits.length) return 'weak';
  const mh = String(moduleHint || '').toLowerCase();
  if (!mh) return 'correct';
  const hit = cits.some(c => String(c?.module || '').toLowerCase().includes(mh));
  return hit ? 'correct' : 'weak';
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const benchmark = fs.readFileSync(BENCH_PATH, 'utf-8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));

  const email = `gemini36_${Date.now()}@uni.edu`;
  let r = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Gemini36 Eval', email, password: 'Password123!' })
  });
  if (r.status !== 200) throw new Error('signup failed: ' + r.text);

  const files = walkFiles(SLIDES_DIR).filter(p => /\.(pdf|pptx|ppt)$/i.test(p));
  console.log(`Uploading ${files.length} files...`);
  for (const p of files) {
    const b = fs.readFileSync(p);
    const form = new FormData();
    form.append('file', new Blob([b], { type: mimeFor(p) }), path.basename(p));
    const up = await req('/api/files', { method: 'POST', body: form });
    if (up.status !== 200) {
      console.log('upload failed', p, up.status);
    }
  }

  const rows = [];
  for (const q of benchmark) {
    let last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await req('/api/rag/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q.question, mode: 'answer' })
      });
      last = res;
      if (res.status === 503 && attempt < 3) {
        await sleep(2500 * attempt);
        continue;
      }
      break;
    }

    const providerFail = last.status !== 200;
    const predicted = providerFail ? 'INSUFFICIENT' : normalizeState(last.json?.supportState);
    const citations = providerFail ? [] : (last.json?.citations || []);
    const answerQuality = classifyAnswerQuality(q.expected_support_type, predicted);
    const refusalStatus = classifyRefusal(q.expected_support_type, predicted);
    const citationQuality = classifyCitationQuality(q.expected_support_type, predicted, citations, q.module_hint);
    const retrievalStatus = ((String(q.expected_support_type).toUpperCase() === 'UNSUPPORTED' && predicted === 'INSUFFICIENT') ||
      (String(q.expected_support_type).toUpperCase() !== 'UNSUPPORTED' && (predicted === 'SUPPORTED' || predicted === 'PARTIAL'))) ? 'retrieval_success' : 'retrieval_miss';

    rows.push({
      question_id: q.question_id,
      question: q.question,
      module_hint: q.module_hint,
      question_type: q.question_type,
      expected_support_type: String(q.expected_support_type).toUpperCase(),
      predicted_support_state: predicted,
      retrieval_status: retrievalStatus,
      answer_quality: answerQuality,
      citation_quality: citationQuality,
      refusal_status: refusalStatus,
      provider_status: last.status,
      provider_error: providerFail ? (last.json?.message || last.text || '') : '',
      answer: providerFail ? '' : (last.json?.answer || ''),
      citations: JSON.stringify(citations),
    });
    console.log(`Done ${q.question_id}: ${predicted} (${last.status})`);
  }

  const n = rows.length;
  const pct = (x) => x / n;
  const summary = {
    config: 'gemini_grounded_answer_layer_eval_v1',
    num_questions: n,
    answer_correct_rate: pct(rows.filter(r => r.answer_quality === 'correct').length),
    answer_partly_correct_rate: pct(rows.filter(r => r.answer_quality === 'partly_correct').length),
    citation_correct_rate: pct(rows.filter(r => r.citation_quality === 'correct').length),
    refusal_accuracy: pct(rows.filter(r => r.refusal_status === 'refusal_correct').length),
    unsupported_over_answer_rate: pct(rows.filter(r => r.expected_support_type === 'UNSUPPORTED' && r.predicted_support_state !== 'INSUFFICIENT').length),
    weak_or_misaligned_citation_count: rows.filter(r => r.citation_quality !== 'correct').length,
    provider_failure_count: rows.filter(r => r.provider_status !== 200).length,
    support_state_distribution: rows.reduce((a, r) => (a[r.predicted_support_state] = (a[r.predicted_support_state] || 0) + 1, a), {}),
  };

  const perPath = path.join(OUT_DIR, 'gemini36_per_question.csv');
  const sumPath = path.join(OUT_DIR, 'gemini36_summary.json');
  const headers = Object.keys(rows[0] || {});
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
  fs.writeFileSync(perPath, csv);
  fs.writeFileSync(sumPath, JSON.stringify(summary, null, 2));
  console.log('Saved', perPath);
  console.log('Saved', sumPath);
})();