"use client";

import Link from "next/link";
import { useState } from "react";
import { explorerUrl, formatSol, timeAgo } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";
import { Avatar, Badge, Select, type Tone } from "../ui";
import { CoinsIcon, ExternalIcon } from "../ui/icons";
import { DataTable, type Column } from "./data-table";

const STATUS: Record<LedgerEntry["status"], { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  submitted: { label: "Confirming", tone: "warning" },
  pending: { label: "Pending", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const [status, setStatus] = useState("all");
  const rows = status === "all" ? entries : entries.filter((e) => e.status === status);

  const columns: Column<LedgerEntry>[] = [
    {
      key: "who",
      header: "Sponsor to creator",
      primary: true,
      csv: (e) => `${e.donor?.displayName ?? "Anonymous"} -> ${e.recipient.displayName}`,
      sort: (e) => e.recipient.displayName,
      cell: (e) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={e.donor?.displayName ?? "Anonymous"} size={28} />
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {e.donor?.displayName ?? "Anonymous"} <span className="text-fg-subtle">to</span>{" "}
              {e.recipient.displayName}
            </span>
            <Link
              href={`/watch/${e.timelapse.slug}`}
              className="block truncate text-[12px] text-fg-subtle hover:text-fg"
            >
              {e.timelapse.title}
            </Link>
          </span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sort: (e) => e.amountLamports,
      csv: (e) => e.amountLamports / 1e9,
      cell: (e) => <span className="font-mono tabular-nums">{formatSol(e.amountLamports)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sort: (e) => e.status,
      csv: (e) => e.status,
      cell: (e) => (
        <Badge tone={STATUS[e.status].tone} dot>
          {STATUS[e.status].label}
        </Badge>
      ),
    },
    {
      key: "when",
      header: "When",
      sort: (e) => Date.parse(e.createdAt),
      csv: (e) => e.createdAt,
      cell: (e) => <span className="text-fg-muted">{timeAgo(e.createdAt)}</span>,
    },
    {
      key: "sig",
      header: "Transaction",
      csv: (e) => e.signature,
      cell: (e) =>
        e.signature ? (
          <a
            href={explorerUrl(e.signature)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[12px] text-fg-muted hover:text-fg"
          >
            {e.signature.slice(0, 8)}
            <ExternalIcon size={11} />
          </a>
        ) : (
          <span className="text-fg-subtle">None yet</span>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      search={(e) =>
        `${e.donor?.displayName ?? "anonymous"} ${e.recipient.displayName} ${e.timelapse.title} ${e.signature ?? ""}`
      }
      searchLabel="Search people, sessions or signatures"
      filename="sardhana-ledger.csv"
      defaultSort={{ key: "when", dir: "desc" }}
      empty={{
        title: "No transfers match",
        description: "Try another status.",
        icon: <CoinsIcon size={18} />,
      }}
      filters={
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          {Object.entries(STATUS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </Select>
      }
    />
  );
}
