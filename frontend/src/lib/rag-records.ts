import fs from 'fs/promises';
import path from 'path';
import { UserProfile } from '@/lib/profile-store';

const ROOT = path.join(process.cwd(), 'storage', 'records');

function slug(value: string) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9 _.-]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'unknown';
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

function userRoot(userId: string) {
  return path.join(ROOT, slug(userId));
}

function profileTag(profile: UserProfile | null) {
  const degree = slug(profile?.degreeLevel || 'unknown_degree');
  const program = slug(profile?.programName || 'unknown_program');
  return `${degree}__${program}`;
}

function subjectRoot(userId: string, subject: string, profile: UserProfile | null) {
  return path.join(userRoot(userId), profileTag(profile), 'subjects', slug(subject || 'Uncategorized'));
}

export async function writeStudentProfileSnapshot(userId: string, profile: UserProfile | null) {
  const root = userRoot(userId);
  await ensureDir(root);
  const payload = {
    userId,
    degreeLevel: profile?.degreeLevel || '',
    programName: profile?.programName || '',
    subjects: profile?.subjects || [],
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(root, 'student_profile_snapshot.json'), JSON.stringify(payload, null, 2), 'utf8');
}

export async function writeUploadRecord(opts: {
  userId: string;
  subject: string;
  profile: UserProfile | null;
  file: {
    id: string;
    name: string;
    module: string;
    type: string;
    size: number;
    uploadedAt: string;
    storagePath: string;
  };
}) {
  const root = subjectRoot(opts.userId, opts.subject, opts.profile);
  const uploadsDir = path.join(root, 'uploads');
  await ensureDir(uploadsDir);

  const payload = {
    fileId: opts.file.id,
    fileName: opts.file.name,
    subject: opts.file.module,
    type: opts.file.type,
    size: opts.file.size,
    uploadedAt: opts.file.uploadedAt,
    sourceStoragePath: opts.file.storagePath,
  };

  await fs.writeFile(path.join(uploadsDir, `${slug(opts.file.id)}.json`), JSON.stringify(payload, null, 2), 'utf8');
}

export async function writeRetrievalRecord(opts: {
  userId: string;
  queryId: string;
  query: string;
  mode: 'answer' | 'summary';
  supportState: 'SUPPORTED' | 'PARTIAL' | 'INSUFFICIENT';
  profile: UserProfile | null;
  retrievedChunks: Array<any>;
}) {
  const bySubject = new Map<string, any[]>();
  for (const row of opts.retrievedChunks || []) {
    const s = String(row?.module || 'Uncategorized').trim() || 'Uncategorized';
    if (!bySubject.has(s)) bySubject.set(s, []);
    bySubject.get(s)!.push(row);
  }

  for (const [subject, chunks] of bySubject.entries()) {
    const root = subjectRoot(opts.userId, subject, opts.profile);
    const retrievalDir = path.join(root, 'retrieval_chunks');
    await ensureDir(retrievalDir);

    const payload = {
      queryId: opts.queryId,
      query: opts.query,
      mode: opts.mode,
      supportState: opts.supportState,
      chunkCount: chunks.length,
      createdAt: new Date().toISOString(),
      chunks,
    };

    await fs.writeFile(path.join(retrievalDir, `${slug(opts.queryId)}.json`), JSON.stringify(payload, null, 2), 'utf8');
  }
}
