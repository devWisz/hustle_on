import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated and single-use surfaces have nothing to index and, in
      // the case of the verify route, carry a token in the URL.
      disallow: ["/dashboard", "/settings", "/upload", "/auth/", "/login"],
    },
    sitemap: `${site}/sitemap.xml`,
  };
}
