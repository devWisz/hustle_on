interface Category {
  id: string;
  label: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: "all", label: "All work", keywords: [] },
  {
    id: "software",
    label: "Software",
    keywords: [
      "code",
      "coding",
      "app",
      "dashboard",
      "website",
      "site",
      "api",
      "bug",
      "pull request",
      "deploy",
      "software",
      "program",
    ],
  },
  {
    id: "art",
    label: "Art & design",
    keywords: [
      "paint",
      "portrait",
      "canvas",
      "poster",
      "illustration",
      "design",
      "logo",
      "drawing",
      "sketch",
      "colour",
      "color",
    ],
  },
  {
    id: "craft",
    label: "Making & craft",
    keywords: [
      "wood",
      "walnut",
      "table",
      "furniture",
      "joinery",
      "workshop",
      "bookshelf",
      "build",
      "hardware",
      "3d print",
    ],
  },
  {
    id: "fashion",
    label: "Fashion & textiles",
    keywords: [
      "sew",
      "sewing",
      "jacket",
      "pattern",
      "fabric",
      "garment",
      "stitch",
      "knit",
      "clothing",
    ],
  },
  {
    id: "startups",
    label: "Startups & teams",
    keywords: ["launch", "startup", "team", "founder", "customers", "beta", "office", "support"],
  },
  {
    id: "study",
    label: "Study & writing",
    keywords: [
      "study",
      "exam",
      "notes",
      "writing",
      "essay",
      "thesis",
      "research",
      "course",
      "learning",
    ],
  },
];

export function matchesCategory(
  t: { title: string; summary: string },
  categoryId: string,
): boolean {
  if (!categoryId || categoryId === "all") return true;
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return true;
  const text = `${t.title} ${t.summary}`.toLowerCase();
  return cat.keywords.some((k) => text.includes(k));
}
