const fs = require('fs');
const base = 'http://localhost:3104';
let cookie = '';
async function req(path, opt = {}) {
  opt.headers = opt.headers || {};
  if (cookie) opt.headers.cookie = cookie;
  const r = await fetch(base + path, opt);
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch {}
  return { s: r.status, j, t };
}
function wc(x){return String(x||'').trim().split(/\s+/).filter(Boolean).length}
(async()=>{
  const email='wc'+Date.now()+'@uni.edu';
  let r=await req('/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'WC',email,password:'Password123!'})});
  if(r.s!==200) throw new Error('signup failed');
  const files=['D:/Courses_Slides/Programming for Data Analysis and AI/Week06_Slides.pdf'];
  for(const p of files){
    const b=fs.readFileSync(p); const form=new FormData(); form.append('file',new Blob([b],{type:'application/pdf'}),p.split('/').pop());
    r=await req('/api/files',{method:'POST',body:form});
  }
  r=await req('/api/rag/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'give me 300 words explanation about groupby mechanics',mode:'answer'})});
  const ans=r.j?.answer||'';
  console.log(JSON.stringify({status:r.s,supportState:r.j?.supportState,words:wc(ans),answer:ans?.slice(0,500)},null,2));
})();