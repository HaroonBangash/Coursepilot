import fs from 'fs/promises';
import path from 'path';
import { StoreShape, UserFile, QuestionRecord } from '@/lib/models';

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'app-data.json');
const UPLOAD_ROOT = path.join(process.cwd(), 'storage', 'uploads');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const seed: StoreShape = { files: [], questions: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(seed, null, 2), 'utf8');
  }
}

export async function readStore(): Promise<StoreShape> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  return JSON.parse(raw) as StoreShape;
}

export async function writeStore(data: StoreShape) {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function addFile(record: UserFile) {
  const db = await readStore();
  db.files.unshift(record);
  await writeStore(db);
}

export async function updateFile(fileId: string, patch: Partial<UserFile>) {
  const db = await readStore();
  db.files = db.files.map((f) => (f.id === fileId ? { ...f, ...patch } : f));
  await writeStore(db);
}

export async function removeFile(fileId: string) {
  const db = await readStore();
  const found = db.files.find((f) => f.id === fileId);
  db.files = db.files.filter((f) => f.id !== fileId);
  await writeStore(db);
  return found || null;
}

export async function listUserFiles(userId: string) {
  const db = await readStore();
  return db.files.filter((f) => f.userId === userId);
}

export async function getUserFile(userId: string, fileId: string) {
  const db = await readStore();
  return db.files.find((f) => f.userId === userId && f.id === fileId) || null;
}

export async function addQuestion(record: QuestionRecord) {
  const db = await readStore();
  db.questions.unshift(record);
  await writeStore(db);
}

export async function listRecentQuestions(userId: string, limit = 10) {
  const db = await readStore();
  return db.questions.filter((q) => q.userId === userId).slice(0, limit);
}

export async function getQuestion(userId: string, questionId: string) {
  const db = await readStore();
  return db.questions.find((q) => q.userId === userId && q.id === questionId) || null;
}

export async function ensureUserUploadDir(userId: string) {
  const userDir = path.join(UPLOAD_ROOT, userId);
  await fs.mkdir(userDir, { recursive: true });
  return userDir;
}
