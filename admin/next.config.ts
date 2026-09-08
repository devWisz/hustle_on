import type { NextConfig } from "next";

/**
 * The admin console is never indexed and never framed. Its CSP is tighter
 * than the public site's: no external images, no external media, nothing to
 * load from anywhere but this origin and the API.
 */
// See the note in frontend/next.config.ts: development Fast Refresh needs
// eval, production never does.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data:",
  "connect-src 'self' " +
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085") +
    (isDev ? " ws://localhost:* wss://localhost:* http://localhost:* http://127.0.0.1:*" : ""),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];

    if (!isDev) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
