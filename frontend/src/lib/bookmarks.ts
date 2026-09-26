"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api/client";
import type { Timelapse } from "./types";

const STORAGE_KEY = "sardhana-bookmarks";
const EVENT_NAME = "sardhana-bookmarks-changed";

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
  savedAt: string;
}

function toSaved(t: Timelapse, savedAt: string): SavedTimelapse {
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
    savedAt,
  };
}

export function getBookmarks(): SavedTimelapse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedTimelapse[]) : [];
  } catch {
    return [];
  }
}

function persist(items: SavedTimelapse[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

function cacheLocally(items: SavedTimelapse[]) {
  if (typeof window === "undefined") return;
  persist(items);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

async function fetchServerBookmarks(): Promise<SavedTimelapse[] | null> {
  try {
    const page = await api<{ items: Timelapse[] }>("/v1/me/bookmarks");
    const now = new Date().toISOString();
    return page.items.map((t) => toSaved(t, now));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    return null;
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<SavedTimelapse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const signedInRef = useRef(false);

  useEffect(() => {
    setBookmarks(getBookmarks());
    setLoaded(true);

    let cancelled = false;
    void fetchServerBookmarks().then((remote) => {
      if (cancelled || remote === null) return;
      signedInRef.current = true;
      setSignedIn(true);
      setBookmarks(remote);
      cacheLocally(remote);
    });

    function handleUpdate() {
      setBookmarks(getBookmarks());
    }
    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isBookmarked = useCallback(
    (slug: string) => bookmarks.some((b) => b.slug === slug),
    [bookmarks],
  );

  const toggleBookmark = useCallback(async (t: Timelapse): Promise<boolean> => {
    const current = getBookmarks();
    const exists = current.some((b) => b.slug === t.slug);
    const next = exists
      ? current.filter((b) => b.slug !== t.slug)
      : [toSaved(t, new Date().toISOString()), ...current];

    cacheLocally(next);
    setBookmarks(next);

    if (!signedInRef.current) return !exists;

    try {
      if (exists) {
        await api(`/v1/me/bookmarks/${encodeURIComponent(t.slug)}`, { method: "DELETE" });
      } else {
        await api(`/v1/me/bookmarks/${encodeURIComponent(t.slug)}`, { method: "PUT" });
      }
      return !exists;
    } catch (err) {
      cacheLocally(current);
      setBookmarks(current);
      throw err;
    }
  }, []);

  const removeBookmark = useCallback(async (slug: string): Promise<void> => {
    const current = getBookmarks();
    const next = current.filter((b) => b.slug !== slug);
    cacheLocally(next);
    setBookmarks(next);

    if (!signedInRef.current) return;
    try {
      await api(`/v1/me/bookmarks/${encodeURIComponent(slug)}`, { method: "DELETE" });
    } catch (err) {
      cacheLocally(current);
      setBookmarks(current);
      throw err;
    }
  }, []);

  return {
    bookmarks,
    loaded,
    signedIn,
    count: bookmarks.length,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
  };
}
