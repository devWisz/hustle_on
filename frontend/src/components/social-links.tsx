import type { SocialLink } from "@/lib/types";
import { platformIcons } from "./icons";
import { CheckIcon } from "./icons";

const labels: Record<SocialLink["platform"], string> = {
  x: "X",
  github: "GitHub",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  website: "Website",
};

/**
 * A creator's external accounts.
 *
 * A verified link carries a check; an unverified one does not, and the
 * difference is stated in the accessible name rather than only in colour, so a
 * claim someone has not proven is never presented as though they had.
 */
export function SocialLinks({ links, size = 18 }: { links: SocialLink[]; size?: number }) {
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {links.map((link) => {
        const Icon = platformIcons[link.platform];
        const label = labels[link.platform];
        return (
          <li key={link.platform}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={`${label}: ${link.username}${link.verified ? " (verified)" : ""}`}
              aria-label={`${label}, ${link.username}${link.verified ? ", verified" : ", not verified"}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border
                         bg-surface px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors
                         hover:border-border-strong hover:text-fg"
            >
              <Icon size={size} title="" />
              <span className="max-w-28 truncate">{link.username}</span>
              {link.verified ? <CheckIcon size={13} className="text-accent" /> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
