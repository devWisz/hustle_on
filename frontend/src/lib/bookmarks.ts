"use client";

import { useCallback, useEffect, useState } from "react";
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

export function getBookmarks(): SavedTimelapse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookmarksToStorage(items: SavedTimelapse[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Storage quota or disabled.
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<SavedTimelapse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setBookmarks(getBookmarks());
    setLoaded(true);

    function handleUpdate() {
      setBookmarks(getBookmarks());
    }

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const isBookmarked = useCallback(
    (slug: string) => {
      return bookmarks.some((b) => b.slug === slug);
    },
    [bookmarks],
  );

  const toggleBookmark = useCallback(
    (t: Timelapse): boolean => {
      const current = getBookmarks();
      const exists = current.some((b) => b.slug === t.slug);
      let updated: SavedTimelapse[];

      if (exists) {
        updated = current.filter((b) => b.slug !== t.slug);
      } else {
        const item: SavedTimelapse = {
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
          savedAt: new Date().toISOString(),
        };
        updated = [item, ...current];
      }

      saveBookmarksToStorage(updated);
      setBookmarks(updated);
      return !exists;
    },
    [],
  );

  const removeBookmark = useCallback((slug: string) => {
    const current = getBookmarks();
    const updated = current.filter((b) => b.slug !== slug);
    saveBookmarksToStorage(updated);
    setBookmarks(updated);
  }, []);

  return {
    bookmarks,
    loaded,
    count: bookmarks.length,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
  };
}
