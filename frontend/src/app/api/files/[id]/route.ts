import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFile, removeFile } from '@/lib/data-store';
import { requireSessionFromRequest } from '@/lib/auth-server';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = requireSessionFromRequest(req);
    const file = await getUserFile(session.userId, params.id);
    if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });

    await removeFile(params.id);
    await fs.rm(file.storagePath, { force: true });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  }
}
