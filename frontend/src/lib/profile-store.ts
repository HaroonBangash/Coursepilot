import fs from 'fs/promises';
import path from 'path';

export type UserProfile = {
  userId: string;
  degreeLevel: string;
  programName: string;
  subjects: string[];
  displayName?: string;
  timezone?: string;
  language?: string;
  notificationsEmail?: boolean;
  notificationsProduct?: boolean;
  defaultAnswerMode?: 'concise' | 'balanced' | 'detailed';
  createdAt: string;
  updatedAt: string;
};

type ProfileDB = {
  profiles: UserProfile[];
};

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILE_FILE = path.join(DATA_DIR, 'user-profiles.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PROFILE_FILE);
  } catch {
    const seed: ProfileDB = { profiles: [] };
    await fs.writeFile(PROFILE_FILE, JSON.stringify(seed, null, 2), 'utf8');
  }
}

async function readDB(): Promise<ProfileDB> {
  await ensureStore();
  const raw = await fs.readFile(PROFILE_FILE, 'utf8');
  return JSON.parse(raw) as ProfileDB;
}

async function writeDB(db: ProfileDB) {
  await ensureStore();
  await fs.writeFile(PROFILE_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = await readDB();
  return db.profiles.find((p) => p.userId === userId) || null;
}

export async function upsertUserProfile(input: {
  userId: string;
  degreeLevel: string;
  programName: string;
  subjects: string[];
  displayName?: string;
  timezone?: string;
  language?: string;
  notificationsEmail?: boolean;
  notificationsProduct?: boolean;
  defaultAnswerMode?: 'concise' | 'balanced' | 'detailed';
}) {
  const db = await readDB();
  const now = new Date().toISOString();
  const cleanSubjects = Array.from(new Set((input.subjects || []).map((s) => String(s).trim()).filter(Boolean)));

  const idx = db.profiles.findIndex((p) => p.userId === input.userId);
  const prev = idx >= 0 ? db.profiles[idx] : null;

  const payload: UserProfile = {
    userId: input.userId,
    degreeLevel: String(input.degreeLevel || '').trim(),
    programName: String(input.programName || '').trim(),
    subjects: cleanSubjects,
    displayName: String(input.displayName ?? prev?.displayName ?? '').trim() || undefined,
    timezone: String(input.timezone ?? prev?.timezone ?? '').trim() || undefined,
    language: String(input.language ?? prev?.language ?? '').trim() || undefined,
    notificationsEmail: typeof input.notificationsEmail === 'boolean' ? input.notificationsEmail : (prev?.notificationsEmail ?? true),
    notificationsProduct: typeof input.notificationsProduct === 'boolean' ? input.notificationsProduct : (prev?.notificationsProduct ?? true),
    defaultAnswerMode: input.defaultAnswerMode ?? prev?.defaultAnswerMode ?? 'balanced',
    createdAt: idx >= 0 ? db.profiles[idx].createdAt : now,
    updatedAt: now,
  };

  if (idx >= 0) db.profiles[idx] = payload;
  else db.profiles.push(payload);

  await writeDB(db);
  return payload;
}
