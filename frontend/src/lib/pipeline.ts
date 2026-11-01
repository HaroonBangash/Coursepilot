import { execFile } from 'child_process';
import path from 'path';

const PYTHON_BIN = process.env.RAG_PYTHON_BIN || 'python';
const SCRIPT = path.join(process.cwd(), 'scripts', 'rag_user_pipeline.py');

function run(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(PYTHON_BIN, [SCRIPT, ...args], { cwd: process.cwd(), timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      try {
        const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '{}';
        resolve(JSON.parse(line));
      } catch (e) {
        reject(new Error('Invalid pipeline output'));
      }
    });
  });
}

export async function ingestUserFile(opts: { userId: string; filePath: string; fileId: string; fileName: string; module?: string }) {
  return run([
    '--mode', 'ingest',
    '--user-id', opts.userId,
    '--file-path', opts.filePath,
    '--file-id', opts.fileId,
    '--file-name', opts.fileName,
    ...(opts.module ? ['--module', opts.module] : []),
  ]);
}

export async function retrieveUserChunks(opts: { userId: string; query: string; k?: number; retrievePoolK?: number; rerank?: boolean; dedup?: boolean; metadataFilter?: boolean }) {
  return run([
    '--mode', 'retrieve',
    '--user-id', opts.userId,
    '--query', opts.query,
    '--k', String(opts.k || 5),
    '--retrieve-pool-k', String(opts.retrievePoolK || 20),
    ...(opts.rerank === false ? [] : ['--rerank']),
    ...(opts.dedup === false ? [] : ['--dedup']),
    ...(opts.metadataFilter === false ? [] : ['--metadata-filter']),
  ]);
}
