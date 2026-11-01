import { NextRequest, NextResponse } from 'next/server';
import { requireSessionFromRequest } from '@/lib/auth-server';
import { getUserProfile, upsertUserProfile } from '@/lib/profile-store';

export async function GET(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const profile = await getUserProfile(session.userId);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load profile.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSessionFromRequest(req);
    const body = await req.json();

    const degreeLevel = String(body?.degreeLevel || '').trim();
    const programName = String(body?.programName || '').trim();
    const subjects = Array.isArray(body?.subjects) ? body.subjects : [];
    const displayName = String(body?.displayName || '').trim();
    const timezone = String(body?.timezone || '').trim();
    const language = String(body?.language || '').trim();
    const notificationsEmail = typeof body?.notificationsEmail === 'boolean' ? body.notificationsEmail : undefined;
    const notificationsProduct = typeof body?.notificationsProduct === 'boolean' ? body.notificationsProduct : undefined;
    const defaultAnswerMode = ['concise', 'balanced', 'detailed'].includes(String(body?.defaultAnswerMode || ''))
      ? body.defaultAnswerMode
      : undefined;

    if (!degreeLevel || !programName || !subjects.length) {
      return NextResponse.json({ error: 'degreeLevel, programName, and at least one subject are required.' }, { status: 400 });
    }

    const profile = await upsertUserProfile({
      userId: session.userId,
      degreeLevel,
      programName,
      subjects,
      displayName,
      timezone,
      language,
      notificationsEmail,
      notificationsProduct,
      defaultAnswerMode,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to save profile.' }, { status: 500 });
  }
}
