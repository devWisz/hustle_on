"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api/client";
import { explorerUrl, formatSol, timeAgo } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Badge, Button, Select, type Tone } from "../ui";
import { CoinsIcon, ExternalIcon } from "../ui/icons";
import { DataTable, type Column } from "./data-table";

const STATUS: Record<LedgerEntry["status"], { label: string; tone: Tone }> = {
  confirmed: { label: "Confirmed", tone: "success" },
  submitted: { label: "Confirming", tone: "warning" },
  pending: { label: "Pending", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState(entries);
  const [rechecking, setRechecking] = useState<string | null>(null);
  const rows = status === "all" ? items : items.filter((e) => e.status === status);

  /**
   * Ask the chain about one donation now.
   *
   * The settle loop already retries unconfirmed donations every couple of minutes,
   * so this is not a repair path: it is the answer to a donor who says they paid
   * and cannot see it, given while they are still on the page. The server
   * re-verifies against the stored amount and recipient, so nothing here can
   * credit a transfer the chain does not support.
   */
  async function recheck(entry: LedgerEntry) {
    setRechecking(entry.id);
    try {
      const result = await api<{ status: string; message?: string }>(
        `/v1/admin/donations/${entry.id}/recheck`,
        { method: "POST" },
      );
      if (result.status === "confirmed") {
        setItems((list) =>
          list.map((x) => (x.id === entry.id ? { ...x, status: "confirmed" } : x)),
        );
        toast.success("Confirmed against the chain and credited.");
        router.refresh();
      } else {
        toast.info(result.message ?? "The network has not finalized that transaction yet.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That re-check did not go through.");
    } finally {
      setRechecking(null);
    }
  }

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
        <span className="inline-flex items-center gap-2">
          <Badge tone={STATUS[e.status].tone} dot>
            {STATUS[e.status].label}
          </Badge>
          {e.status === "submitted" ? (
            <Button
              size="sm"
              variant="ghost"
              loading={rechecking === e.id}
              onClick={() => void recheck(e)}
            >
              Re-check
            </Button>
          ) : null}
        </span>
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
      filename="hustleon-ledger.csv"
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
