import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-level guard for authenticated routes.
 *
 * This is a redirect for the visitor's benefit, not a security boundary: it
 * only checks that a session cookie exists, and the cookie's contents are
 * opaque here. The API validates every request on its own, so a forged cookie
 * gets someone a rendered shell and nothing else.
 */
const PROTECTED = ["/dashboard", "/settings", "/upload", "/jobs/new", "/notifications"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return NextResponse.next();
  }

  const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "hustler_on_session";
  if (request.cookies.has(cookieName)) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/jobs/new",
    "/notifications",
  ],
};
