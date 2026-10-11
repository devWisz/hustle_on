"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/api/client";
import { canRemember } from "@/lib/consent";
import { cx, formatSession } from "@/lib/format";
import type { Page, Timelapse } from "@/lib/types";
import { MOTION, gsap, useGSAP } from "../motion/gsap";
import {
  ArrowRightIcon,
  GridIcon,
  InboxIcon,
  PlayIcon,
  SearchIcon,
  SettingsIcon,
  UploadIcon,
} from "../ui/icons";

const OPEN_EVENT = "hustleon:command";
const RECENT_KEY = "hustleon-recent-searches";

export function openCommandSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

export function CommandSearch({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Timelapse[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  useEffect(() => {
    try {
      setRecents(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {
      setRecents([]);
    }
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping())) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useGSAP(
    () => {
      if (!open || !panel.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION, () => {
        gsap.from(panel.current, {
          y: -12,
          scale: 0.98,
          autoAlpha: 0,
          duration: 0.35,
          ease: "power3.out",
        });
      });
    },
    { dependencies: [open] },
  );

  function search(term: string) {
    clearTimeout(timer.current);
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl()}/v1/timelapses?q=${encodeURIComponent(term)}&limit=6`, {
          credentials: "include",
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Page<Timelapse>;
        setResults(data.items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setActive(0);
      }
    }, 180);
  }

  function remember(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, 5);
    setRecents(next);
    try {
      if (canRemember()) localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      return;
    }
  }

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const items: Item[] = useMemo(() => {
    if (query.trim()) {
      return results.map((t) => ({
        id: t.id,
        label: t.title,
        hint: `${t.creator.displayName}${t.sessionMinutes ? ` · ${formatSession(t.sessionMinutes)}` : ""}`,
        icon: <PlayIcon size={13} />,
        run: () => {
          remember(query);
          go(`/watch/${t.slug}`);
        },
      }));
    }
    const recent: Item[] = recents.map((term) => ({
      id: `recent-${term}`,
      label: term,
      hint: "Recent search",
      icon: <SearchIcon size={14} />,
      run: () => {
        setQuery(term);
        search(term);
      },
    }));
    const pages: Item[] = [
      {
        id: "feed",
        label: "Browse the feed",
        icon: <PlayIcon size={13} />,
        run: () => go("/#feed"),
      },
      {
        id: "upload",
        label: "Upload a timelapse",
        icon: <UploadIcon size={15} />,
        run: () => go("/upload"),
      },
      {
        id: "dashboard",
        label: "Open your dashboard",
        icon: <GridIcon size={15} />,
        run: () => go("/dashboard"),
      },
      ...(isAdmin
        ? [
            {
              id: "admin",
              label: "Open the admin console",
              icon: <InboxIcon size={15} />,
              run: () => go("/admin"),
            },
          ]
        : []),
      {
        id: "settings",
        label: "Account settings",
        icon: <SettingsIcon size={15} />,
        run: () => go("/settings"),
      },
    ];
    return [...recent, ...pages];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results, recents, go, isAdmin]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[12vh] sm:px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={close}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface shadow-[var(--shadow-lifted)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <SearchIcon size={17} className="shrink-0 text-fg-subtle" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value);
            }}
            placeholder="Search sessions, creators, or jump to a page"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle sm:text-[15px]"
          />
          <span className="kbd">esc</span>
        </div>

        <ul id="command-results" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
          {loading ? (
            <li className="px-3 py-8 text-center text-sm text-fg-muted">Searching</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-fg-muted">
              Nothing matches &ldquo;{query}&rdquo;
            </li>
          ) : (
            items.map((item, i) => (
              <li key={item.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={item.run}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm transition-colors",
                    i === active ? "bg-surface-raised text-fg" : "text-fg-muted",
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg-muted">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{item.label}</span>
                    {item.hint ? (
                      <span className="block truncate text-[12px] text-fg-subtle">{item.hint}</span>
                    ) : null}
                  </span>
                  {i === active ? (
                    <ArrowRightIcon size={14} className="shrink-0 text-fg-subtle" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-[11.5px] text-fg-subtle sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> to move
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↵</span> to open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="kbd">⌘</span>
            <span className="kbd">K</span> anywhere
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
