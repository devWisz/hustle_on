import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/discover", "/hire", "/jobs", "/security", "/terms", "/privacy"];
  return routes.map((route) => ({
    url: `${site}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
}
