"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api/client";
import type { Timelapse } from "./types";

/**
 * Saved sessions live on the server and nowhere else.
 *
 * This used to be a hybrid: a copy in localStorage that worked signed out, and a
 * copy on the account that overrode it once you signed in. The two could
 * disagree, a cleared browser silently lost everything, and the marketing-consent
 * toggle deleted the list because it was stored under a key that looked like a
 * preference. None of that was worth the convenience of saving something while
 * signed out — an account is free, so saving requires one.
 *
 * The state is held in a context rather than in each hook instance so that every
 * save button on a page agrees with the others without N requests and without
 * subscribing to a global event name.
 */

export interface SavedTimelapse {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sessionMinutes: number;
  durationSeconds: number;
  thumbnailUrl?: string;
  playbackUrl?: string;
  publishedAt?: string;
  viewCount: number;
  donationTotalLamports: number;
  creator: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl?: string;
  };
}

/** Thrown when a signed-out visitor tries to save something. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in to save a session.");
    this.name = "SignInRequiredError";
  }
}

interface BookmarksValue {
  bookmarks: SavedTimelapse[];
  /** False until the first answer has arrived, so the UI can avoid guessing. */
  loaded: boolean;
  signedIn: boolean;
  isBookmarked(slug: string): boolean;
  /** Returns true when the session is now saved. Throws SignInRequiredError when signed out. */
  toggle(timelapse: Timelapse): Promise<boolean>;
  removeBookmark(slug: string): Promise<void>;
  hasMore: boolean;
  loadMore(): Promise<void>;
}

const BookmarksContext = createContext<BookmarksValue | null>(null);

function toSaved(t: Timelapse): SavedTimelapse {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    summary: t.summary,
    sessionMinutes: t.sessionMinutes,
    durationSeconds: t.durationSeconds,
    thumbnailUrl: t.thumbnailUrl,
    playbackUrl: t.playbackUrl,
    publishedAt: t.publishedAt,
    viewCount: t.viewCount,
    donationTotalLamports: t.donationTotalLamports,
    creator: {
      id: t.creator.id,
      handle: t.creator.handle,
      displayName: t.creator.displayName,
      avatarUrl: t.creator.avatarUrl,
    },
  };
}

interface Page {
  items: Timelapse[];
  nextCursor?: string;
}

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<SavedTimelapse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const session = await api<{ authenticated: boolean }>("/v1/auth/session");
        if (cancelled || !session.authenticated) return;

        const page = await api<Page>("/v1/me/bookmarks");
        if (cancelled) return;
        setSignedIn(true);
        setBookmarks(page.items.map(toSaved));
        setCursor(page.nextCursor);
      } catch {
        // A failed read leaves the list empty rather than reporting an error: a
        // save button that cannot load must not take the page down with it.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const signedInRef = useRef(false);
  signedInRef.current = signedIn;

  const isBookmarked = useCallback(
    (slug: string) => bookmarks.some((b) => b.slug === slug),
    [bookmarks],
  );

  const toggle = useCallback(async (timelapse: Timelapse): Promise<boolean> => {
    if (!signedInRef.current) throw new SignInRequiredError();

    const before = bookmarks;
    const exists = before.some((b) => b.slug === timelapse.slug);
    // Optimistic, then rolled back on failure: the round trip is fast but not
    // instant, and a button that does nothing for 200ms reads as broken.
    setBookmarks(
      exists
        ? before.filter((b) => b.slug !== timelapse.slug)
        : [toSaved(timelapse), ...before],
    );

    try {
      if (exists) {
        await api(`/v1/me/bookmarks/${encodeURIComponent(timelapse.slug)}`, { method: "DELETE" });
      } else {
        await api(`/v1/me/bookmarks/${encodeURIComponent(timelapse.slug)}`, { method: "PUT" });
      }
      return !exists;
    } catch (err) {
      setBookmarks(before);
      throw err;
    }
  }, [bookmarks]);

  const removeBookmark = useCallback(
    async (slug: string) => {
      if (!signedInRef.current) throw new SignInRequiredError();
      const before = bookmarks;
      setBookmarks(before.filter((b) => b.slug !== slug));
      try {
        await api(`/v1/me/bookmarks/${encodeURIComponent(slug)}`, { method: "DELETE" });
      } catch (err) {
        setBookmarks(before);
        throw err;
      }
    },
    [bookmarks],
  );

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const page = await api<Page>(`/v1/me/bookmarks?cursor=${encodeURIComponent(cursor)}`);
    setBookmarks((current) => {
      const seen = new Set(current.map((b) => b.slug));
      return [...current, ...page.items.map(toSaved).filter((b) => !seen.has(b.slug))];
    });
    setCursor(page.nextCursor);
  }, [cursor]);

  const value = useMemo<BookmarksValue>(
    () => ({
      bookmarks,
      loaded,
      signedIn,
      isBookmarked,
      toggle,
      removeBookmark,
      hasMore: Boolean(cursor),
      loadMore,
    }),
    [bookmarks, loaded, signedIn, isBookmarked, toggle, removeBookmark, cursor, loadMore],
  );

  return <BookmarksContext.Provider value={value}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): BookmarksValue {
  const value = useContext(BookmarksContext);
  if (!value) throw new Error("useBookmarks must be used inside <BookmarksProvider>");
  return value;
}
