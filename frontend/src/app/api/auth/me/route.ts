import { NextRequest, NextResponse } from 'next/server';
import { authConfig, verifySessionToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(authConfig.sessionCookieName)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: { id: session.userId, email: session.email, name: session.name },
  });
}
