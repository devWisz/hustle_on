import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, isGuestPreviewable } from "@/lib/guest";

/**
 * Edge middleware.
 *
 * It does two things, and deliberately not a third. It sets the browser policy
 * headers for every response, and it bounces signed-out visitors away from
 * pages that need an account before those pages waste a render.
 *
 * A guest preview is the one exception to that bounce, and it is an exception
 * about rendering, not about access. The guest cookie lets three pages render
 * their sample state instead of redirecting; the API behind them still sees an
 * unauthenticated request and still answers one, so a forged cookie buys
 * exactly the sample data the button hands out for free.
 *
 * What it does not do is authorise anything. The session cookie's presence is
 * a hint — it could be expired, revoked, or belong to a member rather than an
 * admin — so the real check happens in the API, on every request, against the
 * session record. Middleware that decided access on a cookie's existence alone
 * would be trivially bypassed by setting one.
 */

const SECURITY_HEADERS: Record<string, string> = {
  // 'unsafe-inline' covers Next's hydration script and Tailwind's injected
  // styles; connect-src is widened in development for the local API and HMR.
  //
  // 'unsafe-eval' is development-only and not optional there: Next's Fast
  // Refresh runtime evaluates module code as a string, and without it *no*
  // client component hydrates — the dev server renders a page that looks
  // right and does nothing. It is never sent in production, which is the
  // build this policy exists to protect.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isDev() ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:" + (isDev() ? " http://localhost:*" : ""),
    "connect-src 'self' https:" + (isDev() ? " http://localhost:* ws://localhost:*" : ""),
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Routes that are pointless without an account. */
const PROTECTED = ["/dashboard", "/settings", "/upload", "/admin"];

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "sardhana_session";

  const needsAccount = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const signedIn = request.cookies.has(cookieName);
  const previewing = request.cookies.has(GUEST_COOKIE) && isGuestPreviewable(pathname);

  if (needsAccount && !signedIn && !previewing) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return withHeaders(NextResponse.redirect(login));
  }

  return withHeaders(NextResponse.next());
}

function withHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
