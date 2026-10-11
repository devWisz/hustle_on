"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { formatCount, formatSession, formatSol, timeAgo } from "@/lib/format";
import type { Timelapse } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Button, Select } from "../ui";
import { FilmIcon } from "../ui/icons";
import { DataTable, type Column } from "./data-table";
import { TimelapseEditor } from "./timelapse-editor";

export function Library({ initial }: { initial: Timelapse[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [creator, setCreator] = useState("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The row being edited, held as the record rather than an id so the editor can
  // render from what the table is already showing, with no second lookup.
  const [editing, setEditing] = useState<Timelapse | null>(null);

  const creators = Array.from(
    new Map(initial.map((t) => [t.creator.handle, t.creator.displayName])).entries(),
  );
  const rows = creator === "all" ? items : items.filter((t) => t.creator.handle === creator);

  async function toggleFeatured(t: Timelapse) {
    setBusy(`feature:${t.id}`);
    try {
      await api(`/v1/admin/timelapses/${t.id}/feature`, { method: t.featured ? "DELETE" : "POST" });
      setItems((list) => list.map((x) => (x.id === t.id ? { ...x, featured: !t.featured } : x)));
      toast.success(t.featured ? "Removed from the front page." : "Featured on the front page.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  }

  async function takeDown(t: Timelapse) {
    setBusy(t.id);
    try {
      await api(`/v1/admin/timelapses/${t.id}`, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== t.id));
      // An editor left open on a row that no longer exists would save into
      // nothing, so it closes with the row.
      setEditing((current) => (current?.id === t.id ? null : current));
      toast.success("Taken down. It is off the feed.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That takedown did not go through.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  const columns: Column<Timelapse>[] = [
    {
      key: "title",
      header: "Session",
      primary: true,
      sort: (t) => t.title,
      csv: (t) => t.title,
      cell: (t) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-surface-raised sm:block">
            {t.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.thumbnailUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : null}
          </span>
          <span className="min-w-0">
            <Link href={`/watch/${t.slug}`} className="line-clamp-1 font-medium hover:text-accent">
              {t.title}
            </Link>
            <span className="block truncate text-[12px] text-fg-subtle">
              {t.creator.displayName} · {formatSession(t.sessionMinutes)}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "published",
      header: "Published",
      sort: (t) => Date.parse(t.publishedAt ?? t.createdAt),
      csv: (t) => t.publishedAt,
      cell: (t) => (
        <span className="text-fg-muted">{t.publishedAt ? timeAgo(t.publishedAt) : "Not yet"}</span>
      ),
    },
    {
      key: "views",
      header: "Views",
      align: "right",
      sort: (t) => t.viewCount,
      csv: (t) => t.viewCount,
      cell: (t) => <span className="font-mono tabular-nums">{formatCount(t.viewCount)}</span>,
    },
    {
      key: "raised",
      header: "Raised",
      align: "right",
      sort: (t) => t.donationTotalLamports,
      csv: (t) => t.donationTotalLamports / 1e9,
      cell: (t) => (
        <span className="font-mono tabular-nums">{formatSol(t.donationTotalLamports)}</span>
      ),
    },
    {
      key: "featured",
      header: "Front page",
      sort: (t) => (t.featured ? 1 : 0),
      csv: (t) => (t.featured ? "featured" : ""),
      cell: (t) => (
        <Button
          size="sm"
          variant={t.featured ? "inverse" : "secondary"}
          loading={busy === `feature:${t.id}`}
          onClick={() => void toggleFeatured(t)}
          aria-pressed={Boolean(t.featured)}
        >
          {t.featured ? "Featured" : "Feature"}
        </Button>
      ),
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      cell: (t) =>
        confirming === t.id ? (
          <span className="inline-flex gap-1.5">
            <Button
              size="sm"
              variant="danger"
              loading={busy === t.id}
              onClick={() => void takeDown(t)}
            >
              Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
              Keep
            </Button>
          </span>
        ) : (
          <span className="inline-flex gap-1.5">
            <Button
              size="sm"
              variant={editing?.id === t.id ? "inverse" : "secondary"}
              aria-pressed={editing?.id === t.id}
              onClick={() => setEditing(t)}
            >
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(t.id)}>
              Take down
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      {editing ? (
        <TimelapseEditor
          key={editing.id}
          timelapse={editing}
          onPatch={(patch) => {
            setItems((list) => list.map((x) => (x.id === editing.id ? { ...x, ...patch } : x)));
            setEditing((current) => (current ? { ...current, ...patch } : current));
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        search={(t) => `${t.title} ${t.creator.displayName}`}
        searchLabel="Search sessions or creators"
        filename="hustleon-library.csv"
        defaultSort={{ key: "published", dir: "desc" }}
        empty={
          items.length === 0
            ? {
                title: "The library is empty",
                description:
                  "Published sessions appear here as soon as they clear review. If you expected some, the API may not have answered.",
                icon: <FilmIcon size={18} />,
              }
            : {
                title: "No sessions match",
                description: "Try another search or creator.",
                icon: <FilmIcon size={18} />,
              }
        }
        filters={
          <Select
            value={creator}
            onChange={(e) => setCreator(e.target.value)}
            aria-label="Filter by creator"
          >
            <option value="all">All creators</option>
            {creators.map(([handle, name]) => (
              <option key={handle} value={handle}>
                {name}
              </option>
            ))}
          </Select>
        }
      />
    </div>
  );
}
