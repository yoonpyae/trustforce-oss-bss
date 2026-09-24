import { NextRequest, NextResponse } from "next/server";

// Cookie name duplicated from lib/auth-session.ts (kept string-literal, not
// imported) so this file stays a minimal Edge bundle with no DB client in it.
const SESSION_COOKIE = "tf_session";

// Lightweight cookie-presence check only (Edge runtime — no DB round trip here).
// The real session lookup/validation happens in app/(app)/layout.tsx, which
// redirects to /login if the cookie doesn't resolve to a live session, and
// role/module gating also happens there — it reads the pathname forwarded
// below via the x-pathname header, since a Server Component layout has no
// other reliable way to know the current URL.
export function middleware(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  if (!hasCookie) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
