import { NextResponse, type NextRequest } from "next/server";

/**
 * In-memory sliding window rate limiter for edge requests.
 * In a distributed production deployment (e.g. Vercel Edge / Cloudflare Workers / Fly),
 * this can be backed by Redis/KV; for single-instance Next.js edge runtime, an in-memory
 * sliding map with TTL provides low-latency abuse prevention.
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

// Periodic garbage collection for stale rate limit keys
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupStaleBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

const LIMITS: {
  sensitive: RateLimitConfig;
  standard: RateLimitConfig;
} = {
  // Sensitive endpoints: auth, upload, creation
  sensitive: { limit: 25, windowMs: 60_000 },
  // Standard routes: browsing, feed, public reads
  standard: { limit: 120, windowMs: 60_000 },
};

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

function checkRateLimit(ip: string, pathname: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  cleanupStaleBuckets(now);

  const isSensitive =
    pathname.startsWith("/login") ||
    pathname.startsWith("/upload") ||
    pathname.startsWith("/creator/upload") ||
    pathname.startsWith("/api/");

  const cfg = isSensitive ? LIMITS.sensitive : LIMITS.standard;
  const key = `${ip}:${isSensitive ? "sensitive" : "std"}`;

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + cfg.windowMs });
    return {
      allowed: true,
      limit: cfg.limit,
      remaining: cfg.limit - 1,
      resetInSeconds: Math.ceil(cfg.windowMs / 1000),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, cfg.limit - existing.count);
  const resetInSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: existing.count <= cfg.limit,
    limit: cfg.limit,
    remaining,
    resetInSeconds,
  };
}

/** Security headers compliant with OWASP & strict enterprise standards */
const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' http://localhost:* ws://localhost:* https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-XSS-Protection": "0",
};

/** Protected member routes requiring an active session cookie */
const PROTECTED = ["/dashboard", "/settings", "/jobs/new", "/notifications"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE ?? "hustler_on_session";
  const hasSessionCookie = request.cookies.has(cookieName);

  // 1. Rate Limiting Check
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, pathname);

  const baseHeaders = new Headers();
  baseHeaders.set("X-RateLimit-Limit", rate.limit.toString());
  baseHeaders.set("X-RateLimit-Remaining", rate.remaining.toString());
  baseHeaders.set("X-RateLimit-Reset", rate.resetInSeconds.toString());

  // Attach Security Headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    baseHeaders.set(key, value);
  }

  if (!rate.allowed) {
    baseHeaders.set("Retry-After", rate.resetInSeconds.toString());
    return NextResponse.json(
      {
        error: {
          code: "rate_limit_exceeded",
          message: "Too many requests. Please slow down and try again later.",
          retryAfterSeconds: rate.resetInSeconds,
        },
      },
      {
        status: 429,
        headers: baseHeaders,
      }
    );
  }

  // 2. Strict lockdown for any /admin routes:
  // Non-authenticated visitors get an immediate 404 rewrite so the endpoint cannot even be probed.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!hasSessionCookie) {
      // Rewrite to 404 page directly
      const notFoundUrl = new URL("/404", request.url);
      const res = NextResponse.rewrite(notFoundUrl, {
        status: 404,
        headers: baseHeaders,
      });
      return res;
    }
  }

  // 3. Member Protected Routes Guard
  if (PROTECTED.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!hasSessionCookie) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  // Pass request through with rate limit and security headers
  const response = NextResponse.next();
  for (const [key, value] of baseHeaders.entries()) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files, _next, favicon.ico, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
