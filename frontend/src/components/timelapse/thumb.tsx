/**
 * Stand-in artwork for a timelapse with no thumbnail.
 *
 * Most submissions arrive without one, and a grid of identical grey rectangles
 * with a play glyph in the middle is what makes a real feed look like a
 * placeholder. This draws something instead: a ruled field whose angle and
 * density come from the slug, with the work's initials set large and quiet
 * over it. Two different timelapses therefore look different, and the same one
 * looks the same on every visit — it is a hash, not a random number.
 *
 * It is decoration, so it is inert to assistive technology: the card's own
 * title and creator carry the meaning.
 */

const ANGLES = [-30, -15, 0, 15, 30, 45, 60, 75];

/** A small, stable hash. Deterministic across server and client renders. */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Up to two initials from the title, falling back to the creator's. */
function monogram(title: string, fallback: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const source = words.length > 0 ? words : [fallback];
  return source
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function ThumbArtwork({
  seed,
  title,
  creator,
}: {
  seed: string;
  title: string;
  creator: string;
}) {
  const h = hash(seed);
  const angle = ANGLES[h % ANGLES.length] ?? 30;
  const spacing = 9 + (h % 5) * 3;
  const letters = monogram(title, creator);
  // Namespaced so several cards on one page cannot collide over a pattern id.
  const patternId = `rule-${h.toString(36)}`;

  return (
    <svg
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern
          id={patternId}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${angle})`}
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={spacing}
            stroke="var(--border-strong)"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="320" height="180" fill="var(--surface-raised)" />
      <rect width="320" height="180" fill={`url(#${patternId})`} opacity="0.55" />

      {/* The initials, set to read as texture rather than as a label. */}
      <text
        x="22"
        y="132"
        fill="var(--fg)"
        opacity="0.13"
        fontSize="96"
        fontWeight="600"
        letterSpacing="-4"
        fontFamily="var(--font-inter), sans-serif"
      >
        {letters}
      </text>

      {/* One short accent rule, the only colour in the frame. */}
      <rect x="22" y="28" width="34" height="3" rx="1.5" fill="var(--accent)" />
    </svg>
  );
}
