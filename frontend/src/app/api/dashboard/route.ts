import { NextRequest, NextResponse } from 'next/server';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { listRecentQuestions, listUserFiles } from '@/lib/data-store';

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const files = await listUserFiles(session.userId);
    const recent = await listRecentQuestions(session.userId, 8);

    const modulesIndexed = new Set(files.filter((f) => f.status === 'indexed').map((f) => f.module)).size;

    return NextResponse.json({
      stats: {
        filesUploaded: files.length,
        modulesIndexed,
        recentQuestions: recent.length,
      },
      recentQuestions: recent,
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load dashboard data.' }, { status: 500 });
  }
}
