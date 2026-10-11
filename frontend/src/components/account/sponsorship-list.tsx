"use client";

import { formatSol, timeAgo } from "@/lib/format";
import { fetchMySponsorships } from "@/lib/pagination";
import type { Donation } from "@/lib/types";
import { Avatar, PagedList } from "../ui";

/**
 * Sponsorships the signed-in creator has received. The first page is rendered
 * by the dashboard server component; this fetches the rest.
 */
export function SponsorshipList({
  initial,
  initialCursor,
}: {
  initial: Donation[];
  initialCursor?: string;
}) {
  return (
    <PagedList
      initial={initial}
      initialCursor={initialCursor}
      load={fetchMySponsorships}
      label="Load more sponsorships"
      errorText="More sponsorships could not be loaded. Try again."
      className="mt-3 flex flex-col items-center gap-2"
      buttonSize="sm"
      render={(donations) =>
        donations.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-fg-muted">
            None yet. They appear here the moment they confirm.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {donations.map((d) => (
              <li key={d.id} className="flex items-start gap-3 py-3">
                <Avatar name={d.donor?.displayName ?? "Anonymous"} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">{d.donor?.displayName ?? "Anonymous"}</p>
                  {d.message ? (
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">
                      {d.message}
                    </p>
                  ) : null}
                  {d.confirmedAt ? (
                    <p className="mt-1 text-[11.5px] text-fg-subtle">{timeAgo(d.confirmedAt)}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-[12.5px] tabular-nums">
                  {formatSol(d.amountLamports)}
                </span>
              </li>
            ))}
          </ul>
        )
      }
    />
  );
}
