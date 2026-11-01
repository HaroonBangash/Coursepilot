import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'coursepilot_session';
const protectedRoutes = ['/dashboard', '/upload-notes', '/library', '/ask', '/summaries', '/source-viewer', '/settings'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasSessionCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'));

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/upload-notes/:path*', '/library/:path*', '/ask/:path*', '/summaries/:path*', '/source-viewer/:path*', '/settings/:path*'],
};
