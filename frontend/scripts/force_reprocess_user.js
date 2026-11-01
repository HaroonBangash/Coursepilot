const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node scripts/force_reprocess_user.js <userId> [nameFilter]');
  process.exit(1);
}
const nameFilter = process.argv[3] ? process.argv[3].toLowerCase() : null;

const root = process.cwd();
const appDataPath = path.join(root, 'data', 'app-data.json');
const py = process.env.RAG_PYTHON_BIN || 'D:\\Rag Project\\.venv\\Scripts\\python.exe';
const script = path.join(root, 'scripts', 'rag_user_pipeline.py');

const db = JSON.parse(fs.readFileSync(appDataPath, 'utf8'));
const files = db.files.filter(
  (f) =>
    f.userId === userId &&
    ['PDF', 'PPT', 'PPTX', 'TXT'].includes((f.type || '').toUpperCase()) &&
    (!nameFilter || (f.name || '').toLowerCase().includes(nameFilter))
);

if (!files.length) {
  console.log('No files matched.');
  process.exit(0);
}

for (const f of files) {
  try {
    f.status = 'processing';
    fs.writeFileSync(appDataPath, JSON.stringify(db, null, 2), 'utf8');

    const out = execFileSync(py, [
      script,
      '--mode', 'ingest',
      '--user-id', userId,
      '--file-path', f.storagePath,
      '--file-id', f.id,
      '--file-name', f.name,
    ], { encoding: 'utf8' });

    const parsed = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
    f.status = 'indexed';
    f.module = parsed.module || f.module;
    f.lastIndexedAt = new Date().toISOString();
    delete f.error;

    console.log('reprocessed', f.name, 'module=', f.module, 'chunks_added=', parsed.chunks_added);
  } catch (e) {
    f.status = 'failed';
    f.error = String(e.message || e);
    console.error('failed', f.name, f.error);
  }
}

fs.writeFileSync(appDataPath, JSON.stringify(db, null, 2), 'utf8');
console.log('done');
