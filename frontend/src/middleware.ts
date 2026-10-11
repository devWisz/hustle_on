import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV !== "production";

function origin(url: string | undefined, fallback: string): string {
  if (url?.startsWith("/")) return "";
  try {
    return new URL(url ?? fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL, "http://localhost:8085");
const proxyTarget = process.env.API_ORIGIN?.replace(/\/+$/, "") ?? "";
const proxySecret = process.env.INTERNAL_PROXY_SECRET ?? "";
const PROXYABLE = /^\/(v1\/|health(\/ready)?$)/;

function proxyToApi(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const rest = pathname.slice("/api".length);
  if (!proxyTarget || !PROXYABLE.test(rest)) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No such endpoint." } },
      { status: 404 },
    );
  }
  const headers = new Headers(request.headers);
  headers.delete("x-hustleon-client-ip");
  headers.delete("x-hustleon-proxy-key");
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (proxySecret && ip) {
    headers.set("x-hustleon-client-ip", ip);
    headers.set("x-hustleon-proxy-key", proxySecret);
  }
  return NextResponse.rewrite(new URL(`${rest}${search}`, proxyTarget), { request: { headers } });
}
const rpcOrigin = origin(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, "https://api.devnet.solana.com");
const rpcSocket = rpcOrigin.replace(/^http/, "ws");
const uploadOrigin = process.env.UPLOAD_ORIGIN ? origin(process.env.UPLOAD_ORIGIN, "http://localhost") : "";

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    `media-src 'self' blob: https:${isDev ? " http://localhost:*" : ""}`,
    `connect-src 'self' ${apiOrigin} ${rpcOrigin} ${rpcSocket} ${uploadOrigin}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
    "font-src 'self' data:",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const STATIC_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  ...(isDev ? {} : { "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload" }),
};

const PRIVATE = ["/admin", "/dashboard", "/settings", "/upload", "/auth", "/login"];

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) return proxyToApi(request);

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(STATIC_HEADERS)) response.headers.set(key, value);
  response.headers.append("Vary", "Cookie");

  const { pathname } = request.nextUrl;
  if (PRIVATE.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
