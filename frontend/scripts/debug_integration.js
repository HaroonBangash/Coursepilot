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
  const email = 'dbg' + Date.now() + '@uni.edu';
  let r = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Dbg', email, password: 'Password123!' }),
  });
  console.log('signup', r.s);

  const filesToUpload = [
    'D:/Courses_Slides/Programming for Data Analysis and AI/Week02_Slides.pdf',
    'D:/Courses_Slides/Programming for Data Analysis and AI/Week10_Slides.pdf',
  ];

  for (const p of filesToUpload) {
    const b = fs.readFileSync(p);
    const form = new FormData();
    form.append('file', new Blob([b], { type: 'application/pdf' }), p.split('/').pop());
    r = await req('/api/files', { method: 'POST', body: form });
    console.log('upload', p.split('/').pop(), r.s);
  }

  r = await req('/api/files');
  const f = JSON.parse(r.t).files || [];
  console.log('files', f.map((x) => ({ name: x.name, status: x.status, module: x.module })));

  r = await req('/api/rag/debug', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'numpy', k: 5 }),
  });
  console.log('debug numpy', r.s, r.t.slice(0, 1500));

  r = await req('/api/rag/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'numpy', mode: 'answer' }),
  });
  console.log('ask numpy', r.s, r.t.slice(0, 700));
})();
