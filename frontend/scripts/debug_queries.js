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
  return { s: r.status, t, loc: r.headers.get('location') };
}

(async () => {
  const email = 'diag' + Date.now() + '@uni.edu';
  let r = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Diag', email, password: 'Password123!' }),
  });
  console.log('signup', r.s);

  const filesToUpload = [
    'D:/Courses_Slides/AI Foundations in Practice/Reinforcementlearning.pptx',
    'D:/Courses_Slides/Intelligent Data And Text Analytics/Clustering.pdf',
    'D:/Courses_Slides/Big Data And Machine Learning Applications/week1-MapReduce.pdf',
  ];

  for (const p of filesToUpload) {
    const b = fs.readFileSync(p);
    const mime = p.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf';
    const form = new FormData();
    form.append('file', new Blob([b], { type: mime }), p.split('/').pop());
    r = await req('/api/files', { method: 'POST', body: form });
    console.log('upload', p.split('/').pop(), r.s);
  }

  const queries = ['reinforcement learning', 'clustering', 'MapReduce'];
  for (const q of queries) {
    r = await req('/api/rag/debug', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: q, k: 3 }),
    });
    const d = JSON.parse(r.t);
    console.log('\nquery:', q);
    (d.results || []).forEach((x, i) => {
      console.log(i + 1, x.score.toFixed(4), x.file, x.unit_type, x.page_or_slide, x.module);
    });
  }
})();
