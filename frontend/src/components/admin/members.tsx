"use client";

import Link from "next/link";
import { useState } from "react";
import { formatSol, timeAgo } from "@/lib/format";
import type { AdminMember } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Badge, Button, Select } from "../ui";
import { CheckIcon, UsersIcon } from "../ui/icons";
import { DataTable, type Column } from "./data-table";

export function Members({ initial, demo }: { initial: AdminMember[]; demo: boolean }) {
  const toast = useToast();
  const [members, setMembers] = useState(initial);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  const rows = members.filter(
    (m) => (role === "all" || m.role === role) && (status === "all" || m.status === status),
  );

  function toggle(m: AdminMember) {
    const next = m.status === "active" ? "suspended" : "active";
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, status: next } : x)));
    toast.success(
      `Demo: ${m.displayName} ${next === "active" ? "reinstated" : "suspended"} in this view only.`,
    );
  }

  const columns: Column<AdminMember>[] = [
    {
      key: "name",
      header: "Member",
      primary: true,
      sort: (m) => m.displayName,
      csv: (m) => m.displayName,
      cell: (m) => (
        <Link
          href={`/creator/${m.handle}`}
          className="flex min-w-0 items-center gap-3 hover:opacity-80"
        >
          <Avatar name={m.displayName} size={32} />
          <span className="min-w-0">
            <span className="block truncate font-medium">{m.displayName}</span>
            <span className="block truncate text-[12px] text-fg-subtle">{m.email}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "role",
      header: "Role",
      sort: (m) => m.role,
      csv: (m) => m.role,
      cell: (m) => (
        <Badge tone={m.role === "admin" ? "accent" : "neutral"}>
          {m.role === "admin" ? "Admin" : "Member"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (m) => m.status,
      csv: (m) => m.status,
      cell: (m) => (
        <Badge tone={m.status === "active" ? "success" : "danger"} dot>
          {m.status === "active" ? "Active" : "Suspended"}
        </Badge>
      ),
    },
    {
      key: "work",
      header: "Sessions",
      align: "right",
      sort: (m) => m.timelapseCount,
      csv: (m) => m.timelapseCount,
      cell: (m) => (
        <span className="font-mono tabular-nums">
          {m.timelapseCount}
          {m.inReview ? <span className="text-warning"> +{m.inReview}</span> : null}
        </span>
      ),
    },
    {
      key: "raised",
      header: "Raised",
      align: "right",
      sort: (m) => m.donationTotalLamports,
      csv: (m) => m.donationTotalLamports / 1e9,
      cell: (m) => (
        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
          {formatSol(m.donationTotalLamports)}
          {m.payoutVerified ? <CheckIcon size={12} className="text-success" /> : null}
        </span>
      ),
    },
    {
      key: "active",
      header: "Last seen",
      sort: (m) => Date.parse(m.lastActiveAt),
      csv: (m) => m.lastActiveAt,
      cell: (m) => <span className="text-fg-muted">{timeAgo(m.lastActiveAt)}</span>,
    },
    {
      key: "actions",
      header: "Action",
      align: "right",
      cell: (m) =>
        m.role === "admin" ? (
          <span className="text-[12px] text-fg-subtle">Operator</span>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggle(m)}
            disabled={!demo}
            title={demo ? undefined : "Not available in the API yet"}
          >
            {m.status === "active" ? "Suspend" : "Reinstate"}
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      search={(m) => `${m.displayName} ${m.handle} ${m.email}`}
      searchLabel="Search by name, handle or email"
      filename="sardhana-members.csv"
      defaultSort={{ key: "active", dir: "desc" }}
      empty={{
        title: "No members match",
        description: "Try clearing a filter.",
        icon: <UsersIcon size={18} />,
      }}
      filters={
        <div className="flex gap-2">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Filter by role"
          >
            <option value="all">Any role</option>
            <option value="member">Members</option>
            <option value="admin">Admins</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
        </div>
      }
    />
  );
}
