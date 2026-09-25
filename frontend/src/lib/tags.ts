export interface Category {
  id: string;
  label: string;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  { id: "all", label: "All topics", keywords: [] },
  { id: "rust", label: "Rust", keywords: ["rust", "borrow-checker", "lifetime", "cargo", "tokio"] },
  { id: "compilers", label: "Compilers", keywords: ["compiler", "pass", "parsing", "cfg", "dominator", "ast", "lexer", "tree-diff"] },
  { id: "audio", label: "Audio / DSP", keywords: ["synth", "oscillator", "audio", "polyphony", "wavetable", "dsp", "buffer", "sample"] },
  { id: "systems", label: "Systems", keywords: ["kernel", "memory", "allocator", "network", "protocol", "concurrency", "systems"] },
  { id: "go", label: "Go", keywords: ["golang", "go ", "goroutine", "channel"] },
  { id: "frontend", label: "UI & Web", keywords: ["react", "ui", "css", "next.js", "frontend", "animation", "layout", "web"] },
  { id: "algorithms", label: "Algorithms", keywords: ["algorithm", "data structure", "inference", "optimization", "graph", "tree"] },
];

export function getTimelapseTags(t: { title: string; summary: string }): string[] {
  const text = `${t.title} ${t.summary}`.toLowerCase();
  const matched: string[] = [];

  for (const cat of CATEGORIES) {
    if (cat.id === "all") continue;
    const hit = cat.keywords.some((k) => {
      // Word boundary check or substring
      return text.includes(k.toLowerCase());
    });
    if (hit) {
      matched.push(cat.label);
    }
  }

  // Fallback tag if none matched
  if (matched.length === 0) {
    matched.push("Engineering");
  }

  return matched.slice(0, 3);
}

export function matchesCategory(t: { title: string; summary: string }, categoryId: string): boolean {
  if (!categoryId || categoryId === "all") return true;
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return true;
  const text = `${t.title} ${t.summary}`.toLowerCase();
  return cat.keywords.some((k) => text.includes(k.toLowerCase()));
}
