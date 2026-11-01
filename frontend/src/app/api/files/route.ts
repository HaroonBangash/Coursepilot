import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { addFile, ensureUserUploadDir, listUserFiles, updateFile } from '@/lib/data-store';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { UserFile } from '@/lib/models';
import { ingestUserFile } from '@/lib/pipeline';
import { getUserProfile } from '@/lib/profile-store';
import { writeStudentProfileSnapshot, writeUploadRecord } from '@/lib/rag-records';

const allowedExt = new Set(['.pdf', '.pptx', '.txt']);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function moduleGuess(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.includes('ai') || lower.includes('learning')) return 'AI Foundations in Practice';
  if (lower.includes('viz') || lower.includes('visual')) return 'Data Visualisation And Exploratory Analytics';
  if (lower.includes('big') || lower.includes('spark') || lower.includes('mapreduce')) return 'Big Data And Machine Learning Applications';
  if (lower.includes('text') || lower.includes('nlp') || lower.includes('cluster')) return 'Intelligent Data And Text Analytics';
  return 'Programming for Data Analysis and AI';
}

async function runRealIngestion(opts: { userId: string; fileId: string; filePath: string; fileName: string; module?: string }) {
  try {
    await updateFile(opts.fileId, { status: 'processing', error: undefined });
    const out = await ingestUserFile({
      userId: opts.userId,
      filePath: opts.filePath,
      fileId: opts.fileId,
      fileName: opts.fileName,
      ...(opts.module ? { module: opts.module } : {}),
    });

    await updateFile(opts.fileId, {
      status: 'indexed',
      module: out.module || moduleGuess(opts.fileName),
      lastIndexedAt: new Date().toISOString(),
    });
  } catch (e) {
    await updateFile(opts.fileId, { status: 'failed', error: String((e as Error).message || e) });
    throw e;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const files = await listUserFiles(session.userId);
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const form = await req.formData();
    const f = form.get('file');

    if (!(f instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const ext = path.extname(f.name).toLowerCase();
    if (!allowedExt.has(ext)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 400 });
    }

    if (f.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. The limit is 25 MB.' }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const selectedModuleRaw = String(form.get('module') || '').trim();
    const profile = await getUserProfile(session.userId);
    const allowedSubjects = profile?.subjects || [];
    const selectedModule = selectedModuleRaw || moduleGuess(f.name);

    if (!allowedSubjects.length) {
      return NextResponse.json({ error: 'Please complete profile setup (degree/program/subjects) before upload.' }, { status: 400 });
    }

    if (!allowedSubjects.includes(selectedModule)) {
      return NextResponse.json({ error: 'Selected subject is not in your profile subject list.' }, { status: 400 });
    }

    const userDir = await ensureUserUploadDir(session.userId);
    const safeModuleDir = selectedModule.replace(/[^a-zA-Z0-9 _-]/g, '_').trim() || 'Uncategorized';
    const moduleDir = path.join(userDir, safeModuleDir);
    await fs.mkdir(moduleDir, { recursive: true });

    const diskName = `${id}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const savePath = path.join(moduleDir, diskName);

    const bytes = Buffer.from(await f.arrayBuffer());
    await fs.writeFile(savePath, bytes);

    const record: UserFile = {
      id,
      userId: session.userId,
      name: f.name,
      module: selectedModule,
      type: ext.replace('.', '').toUpperCase(),
      size: bytes.byteLength,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      storagePath: savePath,
      lastIndexedAt: undefined,
    };

    await addFile(record);
    await writeStudentProfileSnapshot(session.userId, profile);
    await writeUploadRecord({ userId: session.userId, subject: selectedModule, profile, file: record });
    await runRealIngestion({ userId: session.userId, fileId: id, filePath: savePath, fileName: f.name, module: selectedModule });

    const refreshed = { ...record, status: 'indexed' as const };
    return NextResponse.json({ ok: true, file: refreshed });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Upload failed.' }, { status: 500 });
  }
}
