"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";
import { Button, type ButtonSize } from "./button";

/**
 * PagedList — the one "first page from the server, the rest from the browser"
 * primitive.
 *
 * Every list the API exposes is keyset-paginated: a server component renders
 * the first page into the HTML, so the list exists without JavaScript and is
 * there in the initial paint, and a reader who wants more asks for it. This
 * component owns the part that is easy to get subtly wrong — holding the
 * cursor, appending without duplicating a row, putting the button into a
 * loading state and surfacing a failed request — so each list only has to say
 * how to fetch a page and how to draw its items.
 *
 * `render` owns the empty state: every list has its own copy for "nothing here
 * yet", and the first page is already known before this ever runs.
 */
export interface PagedListProps<T extends { id: string }> {
  /** The first page, already fetched by a server component. */
  initial: T[];
  /** Where the next page starts; absent when the first page is the last. */
  initialCursor?: string;
  /** Fetches one page. Runs in the browser, never during server render. */
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>;
  /** Draws the items accumulated so far, in order. */
  render: (items: T[]) => React.ReactNode;
  /** Button text. Each list names what it is loading. */
  label: string;
  /** Shown under the button when a page fails. */
  errorText?: string;
  /** Wrapper around the button, for the spacing a column or a card wants. */
  className?: string;
  buttonSize?: ButtonSize;
  /**
   * Change this when the query changes — a filter tab, a sort — and the list
   * starts over: the first page is re-fetched in the browser for the new query.
   *
   * Without it, a filtered list has only one option and it is a bad one: page one
   * comes from the server using whatever the server asked for, while every later
   * page uses the filter the reader has since selected. The two answers then
   * belong to different questions, and rows go missing in a way nobody can see.
   * Re-fetching the first page is what makes the whole list answer the same one.
   */
  resetKey?: string;
}

export function PagedList<T extends { id: string }>({
  initial,
  initialCursor,
  load,
  render,
  label,
  errorText = "More could not be loaded. Try again.",
  className = "mt-8 flex flex-col items-center gap-3",
  buttonSize = "md",
  resetKey,
}: PagedListProps<T>) {
  const [items, setItems] = useState<T[]>(initial);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // A server re-render (a refresh, a navigation, something just posted) hands
  // down a new first page. Drop the pages the browser had appended so the two
  // sources cannot overlap or leave a stale row behind.
  useEffect(() => {
    setItems(initial);
    setCursor(initialCursor);
    setFailed(false);
  }, [initial, initialCursor]);

  // The query changed, so the pages accumulated for the old one are not pages of
  // this list any more. The first render is skipped: that page is `initial`, and
  // re-fetching it would throw away the point of rendering it on the server.
  //
  // The loader is read through a ref so the effect can depend on `resetKey`
  // alone. `load` is a new closure on every render, so depending on it would
  // re-fetch the first page continuously; a ref keeps the effect honest about
  // *what* triggers it while still calling the current loader.
  const mounted = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadRef
      .current(undefined)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resetKey]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await load(cursor);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {render(items)}
      {cursor ? (
        <div className={cx(className)}>
          <Button
            variant="secondary"
            size={buttonSize}
            loading={loading}
            onClick={() => void loadMore()}
          >
            {label}
          </Button>
          {failed ? (
            <p role="alert" className="text-[13px] text-danger">
              {errorText}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
