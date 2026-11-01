const fs = require('fs');
const path = require('path');
const STORE = path.join(process.cwd(), 'data', 'app-data.json');
const OUT = path.join(process.cwd(), '../data/eval/dissertation_pitch_pack/query_traces/all_frontend_questions_with_citations_with_chunk_texts.csv');

const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';

const raw = fs.readFileSync(STORE,'utf8');
const db = JSON.parse(raw);
const qs = db.questions || [];
if(!qs.length) { console.error('no questions'); process.exit(1);} 

const rows = qs.map(q => {
  const cits = Array.isArray(q.citations) ? q.citations : [];
  return {
    createdAt: q.createdAt,
    userId: q.userId,
    id: q.id,
    query: q.query,
    mode: q.mode,
    supportState: q.supportState,
    answer: q.answer,
    citations: cits.map(c=> (c.module||'') + ' | ' + (c.file||'') + ' | ' + (c.location||'')).join(' || '),
    chunk_texts: cits.map((c, i) => `[chunk_${i+1}] ` + (c.snippet || '')).join(' || ')
  };
});

fs.mkdirSync(path.dirname(OUT), {recursive:true});
const headers = Object.keys(rows[0]);
const csv = [headers.join(',')].concat(rows.map(r=> headers.map(h=> esc(r[h])).join(','))).join('\n');
fs.writeFileSync(OUT, csv, 'utf8');
console.log('WROTE', OUT);