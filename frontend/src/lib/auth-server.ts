import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { authConfig, SessionPayload, verifySessionToken } from '@/lib/auth';

export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(authConfig.sessionCookieName)?.value;
  return verifySessionToken(token);
}

export function getSessionFromCookieStore(): SessionPayload | null {
  const token = cookies().get(authConfig.sessionCookieName)?.value;
  return verifySessionToken(token);
}

export function requireSessionFromRequest(req: NextRequest): SessionPayload {
  const session = getSessionFromRequest(req);
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}
