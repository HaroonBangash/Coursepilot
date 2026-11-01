import { NextRequest, NextResponse } from 'next/server';
import { authConfig, createSessionToken, verifyPassword } from '@/lib/auth';
import { findUserByEmail } from '@/lib/user-store';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Please enter email and password.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

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
    console.error('login_error', err);
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
