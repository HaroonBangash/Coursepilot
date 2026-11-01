import { NextRequest, NextResponse } from 'next/server';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { retrieveUserChunks } from '@/lib/pipeline';
import { listUserFiles } from '@/lib/data-store';

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const { query, k = 8 } = await req.json();
    const files = await listUserFiles(session.userId);
    const allowedIds = new Set(files.map((f) => f.id));

    const out = await retrieveUserChunks({ userId: session.userId, query, k: Math.max(20, k) });
    const raw = out.results || [];
    const results = raw.filter((r: any) => {
      const fid = String(r.file_id || '');
      return fid && allowedIds.has(fid);
    });

    return NextResponse.json({ ok: true, query, rawCount: raw.length, scopedCount: results.length, results });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Debug retrieval failed.' }, { status: 500 });
  }
}
