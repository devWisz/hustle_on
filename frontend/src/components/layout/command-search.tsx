"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";
import { cx } from "@/lib/format";

/**
 * A command-palette style search bar.
 *
 * Opens with the `/` key, closes with Escape. It searches timelapses by title
 * and shows instant results from the API. Recent searches are remembered in
 * localStorage so the user sees them when reopening.
 */

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  creator: { displayName: string };
}

const MAX_RECENT = 5;
const STORAGE_KEY = "sardhana-recent-searches";

export function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecents(JSON.parse(stored));
    } catch {
      // localStorage may be unavailable.
    }
  }, []);

  // Handle keyboard shortcut to open/close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !isInputFocused()) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8085";
      const res = await fetch(
        `${baseUrl}/v1/timelapses?q=${encodeURIComponent(term)}&limit=6`,
        { credentials: "include" },
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.items ?? []);
      }
    } catch {
      // Search failures are not worth surfacing to the user.
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  }

  function saveRecent(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, MAX_RECENT);
    setRecents(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Silently fail.
    }
  }

  function navigateTo(slug: string) {
    saveRecent(query);
    setOpen(false);
    setQuery("");
    setResults([]);
    window.location.href = `/watch/${slug}`;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex h-8 items-center gap-2 rounded-[var(--radius-control)] border border-border
                   bg-surface px-3 text-[13px] text-fg-subtle transition-colors
                   hover:border-border-strong hover:text-fg-muted"
        aria-label="Search timelapses"
      >
        <SearchIcon size={14} />
        <span>Search</span>
        <kbd className="ml-2 rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
          /
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 drawer-overlay"
        onClick={() => {
          setOpen(false);
          setQuery("");
          setResults([]);
        }}
      />

      {/* Search modal */}
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center pt-[15vh] px-4">
        <div
          className={cx(
            "w-full max-w-lg overflow-hidden rounded-[var(--radius-panel)]",
            "border border-border bg-surface shadow-[var(--shadow-raised)]",
            "animate-scale-in",
          )}
        >
          {/* Input row */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            <SearchIcon size={16} className="shrink-0 text-fg-subtle" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results.length > 0 && results[0]) {
                  navigateTo(results[0].slug);
                }
              }}
              placeholder="Search timelapses..."
              className="flex-1 bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="text-fg-subtle hover:text-fg"
              >
                <CloseIcon size={14} />
              </button>
            )}
            <kbd className="rounded border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-sm text-fg-muted">Searching...</div>
            )}

            {!loading && results.length > 0 && (
              <ul className="py-2">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => navigateTo(r.slug)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm
                                 transition-colors hover:bg-surface-raised"
                    >
                      <span className="truncate font-medium">{r.title}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-fg-subtle">
                        {r.creator.displayName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!loading && query && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-fg-muted">
                No timelapses found for &ldquo;{query}&rdquo;
              </div>
            )}

            {!loading && !query && recents.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-1.5 text-[12px] font-medium text-fg-subtle">
                  Recent searches
                </p>
                {recents.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      search(term);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-fg-muted
                               transition-colors hover:bg-surface-raised hover:text-fg"
                  >
                    <SearchIcon size={13} className="shrink-0" />
                    {term}
                  </button>
                ))}
              </div>
            )}

            {!loading && !query && recents.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-fg-subtle">
                Start typing to search timelapses
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
