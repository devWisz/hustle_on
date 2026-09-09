import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only the pages that exist for everyone. Individual timelapses are not
  // listed here: the feed links every published one, and a sitemap entry for a
  // row that was later taken down would outlive the page itself.
  const routes = ["", "/about", "/terms", "/privacy"];
  return routes.map((route) => ({
    url: `${site}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "monthly",
    priority: route === "" ? 1 : 0.5,
  }));
}
