"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csv";
import { cx } from "@/lib/format";
import { Button, EmptyState, SearchField } from "../ui";
import { ChevronDownIcon, DownloadIcon } from "../ui/icons";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sort?: (row: T) => number | string;
  csv?: (row: T) => string | number | undefined;
  align?: "left" | "right";
  className?: string;
  primary?: boolean;
}

const PAGE_SIZE = 8;

export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  search,
  searchLabel,
  filters,
  filename,
  empty,
  defaultSort,
}: {
  rows: T[];
  columns: Column<T>[];
  search: (row: T) => string;
  searchLabel: string;
  filters?: React.ReactNode;
  filename: string;
  empty: { title: string; description: string; icon?: React.ReactNode };
  defaultSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? rows.filter((r) => search(r).toLowerCase().includes(q)) : rows;
    const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (!sort || !column?.sort) return matched;
    const get = column.sort;
    return [...matched].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const cmp =
        typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, query, sort, columns, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const shown = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }

  function exportCsv() {
    const exportable = columns.filter((c) => c.csv);
    downloadCsv(filename, [
      exportable.map((c) => c.header),
      ...filtered.map((r) => exportable.map((c) => c.csv!(r))),
    ]);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchField
          placeholder={searchLabel}
          aria-label={searchLabel}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="md:max-w-xs md:flex-1"
        />
        {filters}
        <Button variant="secondary" size="sm" onClick={exportCsv} className="md:ml-auto">
          <DownloadIcon size={14} />
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState className="mt-5" {...empty} />
      ) : (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface md:block">
            <table className="w-full text-left text-[13.5px]">
              <thead className="border-b border-border bg-surface-raised/60 text-[12px] text-fg-muted">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        sort?.key === c.key
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      className={cx("px-4 py-2.5 font-medium", c.align === "right" && "text-right")}
                    >
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cx(
                            "inline-flex items-center gap-1 hover:text-fg",
                            sort?.key === c.key && "text-fg",
                          )}
                        >
                          {c.header}
                          <ChevronDownIcon
                            size={12}
                            className={cx(
                              "transition-transform",
                              sort?.key !== c.key && "opacity-30",
                              sort?.key === c.key && sort.dir === "asc" && "rotate-180",
                            )}
                          />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-raised/50">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cx(
                          "px-4 py-3 align-middle",
                          c.align === "right" && "text-right",
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-5 space-y-3 md:hidden">
            {shown.map((row) => (
              <li
                key={row.id}
                className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
              >
                {columns
                  .filter((c) => c.primary)
                  .map((c) => (
                    <div key={c.key}>{c.cell(row)}</div>
                  ))}
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {columns
                    .filter((c) => !c.primary)
                    .map((c) => (
                      <div key={c.key} className="min-w-0">
                        <dt className="text-[11.5px] text-fg-subtle">{c.header}</dt>
                        <dd className="mt-0.5 text-[13px]">{c.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-muted">
            <span>
              {safePage * PAGE_SIZE + 1} to {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)}{" "}
              of {filtered.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={safePage >= pages - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
