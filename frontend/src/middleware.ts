import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV !== "production";
const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085";

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  `media-src 'self' blob: https:${isDev ? " http://localhost:*" : ""}`,
  `connect-src 'self' https: ${apiOrigin}${isDev ? " http://localhost:* ws://localhost:*" : ""}`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  ...(isDev ? {} : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }),
};

const PRIVATE = ["/admin", "/dashboard", "/settings", "/upload", "/auth", "/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(key, value);
  response.headers.append("Vary", "Cookie");
  if (PRIVATE.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    response.headers.set("Cache-Control", "no-store, must-revalidate");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)"],
};
