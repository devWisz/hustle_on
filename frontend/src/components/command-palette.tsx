"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import type { Job, Page, PublicUser, Video } from "@/lib/types";
import { cx, formatSession, formatSol, formatUsd } from "@/lib/format";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  PlayIcon,
  SearchIcon,
  SpinnerIcon,
  UsersIcon,
} from "./icons";

/**
 * The command palette.
 *
 * One keyboard entry point to the whole product: search sessions, people and
 * roles at once, or jump to a route. It exists because the three things this
 * site is made of live behind three different list pages, and someone who knows
 * what they are looking for should not have to pick the right page first.
 *
 * Search hits the same public endpoints the list pages use, so results here can
 * never show something the visitor could not otherwise reach.
 */

interface Result {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  group: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

/** Routes offered before anything is typed, and matched by substring after. */
const ROUTES: { href: string; title: string; subtitle: string }[] = [
  {
    href: "/discover",
    title: "Discover",
    subtitle: "Every published session, newest first",
  },
  { href: "/hire", title: "Hire", subtitle: "People open to work" },
  { href: "/jobs", title: "Roles", subtitle: "Open roles from clients" },
  {
    href: "/upload",
    title: "Upload a session",
    subtitle: "Publish a timelapse",
  },
  {
    href: "/jobs/new",
    title: "Post a role",
    subtitle: "Hire against a public track record",
  },
  {
    href: "/dashboard",
    title: "Dashboard",
    subtitle: "Your sessions, earnings and applications",
  },
  {
    href: "/notifications",
    title: "Notifications",
    subtitle: "Sponsorships and application updates",
  },
  {
    href: "/settings",
    title: "Settings",
    subtitle: "Profile, wallets and linked accounts",
  },
];

/** Time to wait after the last keystroke before searching. */
const DEBOUNCE_MS = 180;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Cmd+K on Apple platforms, Ctrl+K elsewhere. "/" is deliberately not bound:
  // it would swallow the character in every text field on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const routeMatches = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? ROUTES.filter(
          (route) =>
            route.title.toLowerCase().includes(term) ||
            route.subtitle.toLowerCase().includes(term),
        )
      : ROUTES.slice(0, 5);
    return matched.map<Result>((route) => ({
      id: `route:${route.href}`,
      href: route.href,
      title: route.title,
      subtitle: route.subtitle,
      group: "Go to",
      icon: ArrowRightIcon,
    }));
  }, [query]);

  // Search the three public collections in parallel. An aborted request is the
  // normal case while typing, so a failure of any one collection degrades to no
  // results from it rather than an error for the whole palette.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      const encoded = encodeURIComponent(term);
      const get = async <T,>(path: string): Promise<T | null> => {
        try {
          const response = await fetch(`${API_URL}${path}`, {
            signal: controller.signal,
            credentials: "include",
          });
          return response.ok ? ((await response.json()) as T) : null;
        } catch {
          return null;
        }
      };

      const [videos, people, jobs] = await Promise.all([
        get<Page<Video>>(`/v1/feed?limit=5&q=${encoded}`),
        get<Page<PublicUser>>(`/v1/talent?limit=4&q=${encoded}`),
        get<Page<Job>>(`/v1/jobs?limit=4&q=${encoded}`),
      ]);

      if (controller.signal.aborted) return;

      setResults([
        ...(videos?.items ?? []).map<Result>((video) => ({
          id: `video:${video.id}`,
          href: `/watch/${video.slug}`,
          title: video.title,
          subtitle: [
            video.creator.displayName,
            formatSession(video.sessionMinutes),
          ]
            .filter(Boolean)
            .join(" · "),
          group: "Sessions",
          icon: PlayIcon,
        })),
        ...(people?.items ?? []).map<Result>((person) => ({
          id: `person:${person.id}`,
          href: `/creator/${person.handle}`,
          title: person.displayName,
          subtitle:
            person.headline ??
            [
              `@${person.handle}`,
              person.hourlyRateUsd
                ? `${formatUsd(person.hourlyRateUsd)}/hr`
                : null,
              person.sponsorTotalLamports > 0
                ? `${formatSol(person.sponsorTotalLamports)} earned`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
          group: "People",
          icon: UsersIcon,
        })),
        ...(jobs?.items ?? []).map<Result>((job) => ({
          id: `job:${job.id}`,
          href: `/jobs/${job.slug}`,
          title: job.title,
          subtitle: [
            job.client.displayName,
            job.budgetMinUsd ? `${formatUsd(job.budgetMinUsd)}+` : null,
            job.isRemote ? "Remote" : job.location,
          ]
            .filter(Boolean)
            .join(" · "),
          group: "Roles",
          icon: BriefcaseIcon,
        })),
      ]);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const items = useMemo(
    () => [...results, ...routeMatches],
    [results, routeMatches],
  );

  // The highlight must never point past the end of a freshly changed list.
  useEffect(() => {
    setActive((current) => (current < items.length ? current : 0));
  }, [items.length]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (active + delta + items.length) % items.length;
      setActive(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) go(item.href);
    }
  }

  if (!open) return <PaletteTrigger onOpen={() => setOpen(true)} />;

  let lastGroup: string | null = null;

  return (
    <>
      <PaletteTrigger onOpen={() => setOpen(true)} />
      <div className="fixed inset-0 z-[55]">
        {/* Clicking the backdrop dismisses; it is not focusable, and Escape
            covers the keyboard path. */}
        <div
          className="absolute inset-0 bg-fg/20 backdrop-blur-[2px]"
          onClick={close}
          aria-hidden
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search and commands"
          className="relative mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-[var(--radius-panel)]
                     border border-border bg-surface shadow-[var(--shadow-raised)]"
          onKeyDown={onKeyDown}
        >
          <div className="flex items-center gap-3 border-b border-border px-4">
            <SearchIcon size={17} className="shrink-0 text-fg-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sessions, people and roles"
              aria-label="Search sessions, people and roles"
              aria-controls={listId}
              aria-activedescendant={
                items[active] ? `${listId}-${active}` : undefined
              }
              role="combobox"
              aria-expanded
              autoComplete="off"
              spellCheck={false}
              // The dialog already reads as focused and this is its only text
              // input, so the global focus ring would only double the border.
              className="h-14 flex-1 bg-transparent text-[15px] placeholder:text-fg-subtle
                         outline-none focus-visible:outline-none"
            />
            {loading ? (
              <SpinnerIcon size={16} className="shrink-0 text-fg-subtle" />
            ) : null}
          </div>

          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="max-h-[52vh] overflow-y-auto p-2"
          >
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-[13px] text-fg-muted">
                {query.trim().length < 2
                  ? "Type at least two characters to search."
                  : loading
                    ? "Searching."
                    : "Nothing matches that yet."}
              </li>
            ) : (
              items.map((item, index) => {
                const heading = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    {heading ? (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
                        {heading}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === active}
                      onClick={() => go(item.href)}
                      onMouseMove={() => setActive(index)}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left",
                        index === active ? "bg-surface-raised" : "",
                      )}
                    >
                      <span
                        className={cx(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)]",
                          index === active
                            ? "bg-accent-soft text-accent"
                            : "bg-bg text-fg-subtle",
                        )}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block truncate text-[12px] text-fg-muted">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-fg-subtle">
            <span className="flex items-center gap-3">
              <Hint keys="↑ ↓" label="navigate" />
              <Hint keys="Enter" label="open" />
            </span>
            <Hint keys="Esc" label="close" />
          </div>
        </div>
      </div>
    </>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-sans text-[10px] text-fg-muted">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

/**
 * The header control that opens the palette.
 *
 * A keyboard shortcut nobody is told about is a shortcut nobody uses, so the
 * binding is printed on the button. The platform-correct modifier is resolved
 * after mount, since the user agent is not known during a server render.
 */
function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  const [modifier, setModifier] = useState<string | null>(null);

  useEffect(() => {
    const apple = /mac|iphone|ipad|ipod/i.test(
      navigator.platform || navigator.userAgent,
    );
    setModifier(apple ? "⌘" : "Ctrl");
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="hidden h-8 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface
                   pl-2.5 pr-1.5 text-[13px] text-fg-subtle transition-colors hover:border-border-strong hover:text-fg md:flex"
      >
        <SearchIcon size={15} />
        <span>Search</span>
        <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-sans text-[10px] tabular-nums">
          {modifier ? `${modifier} K` : " "}
        </kbd>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Search"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-fg-muted
                   transition-colors hover:bg-surface-raised hover:text-fg md:hidden"
      >
        <SearchIcon size={17} />
      </button>
    </>
  );
}
