export const FEED_SORTS = [
  { value: "", label: "Newest" },
  { value: "funded", label: "Most funded" },
  { value: "watched", label: "Most watched" },
  { value: "longest", label: "Longest" },
] as const;

export type FeedSort = (typeof FEED_SORTS)[number]["value"];

export function parseSort(value: string | string[] | undefined): FeedSort {
  const first = Array.isArray(value) ? value[0] : value;
  return FEED_SORTS.find((s) => s.value === first)?.value ?? "";
}
