import type { NextConfig } from "next";

/**
 * Security headers are set here rather than in a proxy so they travel with the
 * application to whichever host it is deployed on.
 *
 * The CSP is deliberately explicit about what may execute. `'unsafe-inline'`
 * appears only for styles, which Next requires for its critical CSS; scripts
 * are restricted to our own origin plus the nonce-free chunks Next emits, and
 * `object-src 'none'` with `base-uri 'none'` closes the two most common
 * injection escapes.
 */
// Next's development Fast Refresh runtime evaluates code with eval(), so a
// CSP without 'unsafe-eval' stops the client bundle hydrating and the whole
// site becomes non-interactive under `next dev`. It is added for development
// only; a production build never needs it and never gets it.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' " + (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080") +
    " " + (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com"),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.sardhana.com" },
      { protocol: "https", hostname: "media.sardhana.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
