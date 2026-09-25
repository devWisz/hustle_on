"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
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

/**
 * The saved list.
 *
 * Where it lives depends on who is asking. A signed-in reader's list is kept by
 * the API, so it follows them between devices; a signed-out visitor's is kept in
 * this browser, because there is no account for a write to belong to and a saved
 * list is not worth blocking on a sign-in form. The two are not merged: signing
 * in replaces the local list with the account's, which is the only behaviour
 * that does not silently attribute one person's saves to another.
 */

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

function cacheLocally(items: SavedTimelapse[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage quota or disabled. The in-memory list is unaffected.
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** The account's list, or null when there is no account to ask. */
async function fetchServerBookmarks(): Promise<SavedTimelapse[] | null> {
  try {
    const page = await api<{ items: Timelapse[] }>("/v1/me/bookmarks");
    const now = new Date().toISOString();
    return page.items.map((t) => toSaved(t, now));
  } catch (err) {
    // A signed-out visitor is the expected case, not a failure.
    if (err instanceof ApiError && err.status === 401) return null;
    return null;
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<SavedTimelapse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Read by the mutation callbacks so they do not have to be rebuilt — and so a
  // background refresh cannot be clobbered by a stale closure.
  const signedInRef = useRef(false);

  useEffect(() => {
    // Local first so a saved list paints instantly, then the account's list if
    // there is one. The API wins, because it is the list that follows the reader
    // to another device.
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

  /**
   * Saves or unsaves, updating the list immediately and the API behind it.
   *
   * Returns the state the list ended in. Throws if the account's list could not
   * be changed, after putting the list back the way it was — a saved badge that
   * survives a failed write is a promise the product cannot keep.
   */
  const toggleBookmark = useCallback(async (t: Timelapse): Promise<boolean> => {
    const current = getBookmarks();
    const exists = current.some((b) => b.slug === t.slug);
    const next = exists ? current.filter((b) => b.slug !== t.slug) : [toSaved(t, new Date().toISOString()), ...current];

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
