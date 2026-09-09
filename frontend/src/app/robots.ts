import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated and single-use surfaces have nothing worth indexing, and
      // the verify route carries a sign-in token in its URL.
      disallow: ["/dashboard", "/settings", "/upload", "/admin", "/auth/", "/login"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
