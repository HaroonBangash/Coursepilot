const fs = require('fs');

const base = 'http://localhost:3104';
let cookie = '';

async function req(path, opt = {}) {
  opt.headers = opt.headers || {};
  if (cookie) opt.headers.cookie = cookie;
  opt.redirect = 'manual';
  const r = await fetch(base + path, opt);
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  let t = '';
  try { t = await r.text(); } catch {}
  let j = null;
  try { j = JSON.parse(t); } catch {}
  return { s: r.status, t, j };
}

(async () => {
  const email = 'gemverify' + Date.now() + '@uni.edu';
  let r = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Gem Verify', email, password: 'Password123!' }),
  });
  if (r.s !== 200) throw new Error('signup failed: ' + r.t);

  const filesToUpload = [
    'D:/Courses_Slides/AI Foundations in Practice/Reinforcementlearning.pptx',
    'D:/Courses_Slides/Big Data And Machine Learning Applications/week1-MapReduce.pdf',
  ];

  for (const p of filesToUpload) {
    const b = fs.readFileSync(p);
    const mime = p.endsWith('.pptx')
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf';
    const form = new FormData();
    form.append('file', new Blob([b], { type: mime }), p.split('/').pop());
    r = await req('/api/files', { method: 'POST', body: form });
    if (r.s !== 200) throw new Error('upload failed ' + p + ': ' + r.t);
  }

  const cases = [
    { id: 'case1_supported_ai', query: 'Define reinforcement learning in terms of agent, environment, and reward.', mode: 'answer' },
    { id: 'case2_supported_bigdata', query: 'Explain the MapReduce pipeline step by step.', mode: 'answer' },
    { id: 'case3_unsupported', query: 'Explain quantum supremacy applications in medicine from these notes.', mode: 'answer' },
    { id: 'case4_summary', query: 'Summarize the key points of reinforcement learning from the uploaded notes.', mode: 'summary' },
  ];

  const out = [];
  for (const c of cases) {
    r = await req('/api/rag/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: c.query, mode: c.mode }),
    });
    out.push({
      id: c.id,
      status: r.s,
      query: c.query,
      mode: c.mode,
      response: r.j || { raw: r.t },
    });
  }

  const outPath = 'D:/Rag Project/data/eval/final/gemini_phase1_live_verify.json';
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('wrote', outPath);
})();
