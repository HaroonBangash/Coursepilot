import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authConfig, createSessionToken, makePasswordHash } from '@/lib/auth';
import { createUser, findUserByEmail } from '@/lib/user-store';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Please fill in all fields.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email: String(email).toLowerCase(),
      passwordHash: makePasswordHash(password),
      createdAt: new Date().toISOString(),
    };

    await createUser(user);

    const token = createSessionToken({ id: user.id, email: user.email, name: user.name });
    const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });

    res.cookies.set(authConfig.sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: authConfig.sessionTtlSeconds,
    });

    return res;
  } catch (err) {
    console.error('signup_error', err);
    return NextResponse.json({ error: 'Could not create account right now.' }, { status: 500 });
  }
}
