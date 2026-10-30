import { type NextRequest, NextResponse } from "next/server";

const DASHBOARD_RE = /\/[^/]+\/dashboard(\/|$)/;
const ADMIN_RE = /^\/admin(\/|$)/;

function isProtected(pathname: string): boolean {
  return DASHBOARD_RE.test(pathname) || ADMIN_RE.test(pathname);
}

function loginPathFor(pathname: string): string {
  if (ADMIN_RE.test(pathname)) return "/login";
  const slug = pathname.split("/")[1];
  return `/${slug}/login`;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  // Better Auth usa "better-auth.session_token" em HTTP e o prefixo __Secure- em HTTPS.
  const hasSession =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  if (!hasSession) {
    return NextResponse.redirect(new URL(loginPathFor(pathname), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
