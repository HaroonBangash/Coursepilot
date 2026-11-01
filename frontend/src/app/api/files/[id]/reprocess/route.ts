import { NextRequest, NextResponse } from 'next/server';
import { getUserFile, updateFile } from '@/lib/data-store';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { ingestUserFile } from '@/lib/pipeline';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireSessionFromRequest(req);
    const file = await getUserFile(session.userId, params.id);
    if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    await updateFile(file.id, { status: 'processing', error: undefined });
    try {
      const out = await ingestUserFile({
        userId: session.userId,
        fileId: file.id,
        filePath: file.storagePath,
        fileName: file.name,
        module: file.module,
      });
      await updateFile(file.id, { status: 'indexed', module: out.module || file.module, lastIndexedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    } catch (err) {
      await updateFile(file.id, { status: 'failed', error: String((err as Error).message || err) });
      return NextResponse.json({ error: 'Reprocess failed.' }, { status: 500 });
    }
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Reprocess failed.' }, { status: 500 });
  }
}
