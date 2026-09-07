/** Presentation helpers. Formatting lives here so numbers read the same way
 *  on every surface. */

const LAMPORTS_PER_SOL = 1_000_000_000;

/** Renders lamports as SOL with a sensible number of decimals. */
export function formatSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return "0 SOL";
  if (sol < 0.001) return "<0.001 SOL";
  const decimals = sol < 1 ? 3 : sol < 100 ? 2 : 1;
  return `${sol.toFixed(decimals)} SOL`;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/** Compact counts: 1200 becomes 1.2K. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Video runtime, as m:ss or h:mm:ss. */
export function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** The real work time behind a timelapse, in hours and minutes. */
export function formatSession(minutes: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m of work`;
  if (m === 0) return `${h}h of work`;
  return `${h}h ${m}m of work`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return RELATIVE.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(iso));
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Shortens a wallet address for display without losing recognisability. */
export function shortAddress(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** Joins class names, dropping falsy values. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
