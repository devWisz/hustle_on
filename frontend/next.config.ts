import type { NextConfig } from "next";

// `next dev` prints a Network URL beside the local one — that is the address that
// works from a phone on the same network, so it is the one people copy. Next warns
// and, in a future major, will refuse to serve its own dev assets to a host it was
// not told about. Extra hosts go in ALLOWED_DEV_ORIGINS, comma separated.
const devOrigins = ["localhost", "127.0.0.1", ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.NODE_ENV === "production" ? {} : { allowedDevOrigins: devOrigins }),
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.hustleon.com" }],
  },
};

export default nextConfig;
