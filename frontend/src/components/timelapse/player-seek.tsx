"use client";

import { createContext, useContext, useMemo, useRef } from "react";

/**
 * Lets anything on the page ask the video player to jump to a moment.
 *
 * The watch page is a server component, so the player and the notes thread that
 * wants to scrub it cannot share a piece of state directly. A context bridges
 * that gap without either one having to know the other exists: the player
 * registers how to seek while it is mounted, and a timestamped note just calls
 * `seek`. Nothing registers on a page with no player, and the call is then a
 * no-op rather than an error.
 */

type SeekHandler = (seconds: number) => void;

interface PlayerSeekValue {
  register: (handler: SeekHandler) => () => void;
  seek: (seconds: number) => void;
}

const PlayerSeekContext = createContext<PlayerSeekValue | null>(null);

export function PlayerSeekProvider({ children }: { children: React.ReactNode }) {
  // A ref rather than state: registering a handler must not re-render every
  // note in the thread, and only one player is ever mounted at a time.
  const handler = useRef<SeekHandler | null>(null);

  const value = useMemo<PlayerSeekValue>(
    () => ({
      register(next) {
        handler.current = next;
        // The cleanup only clears the slot if this handler still owns it, so an
        // unmount cannot unregister a player that replaced it.
        return () => {
          if (handler.current === next) handler.current = null;
        };
      },
      seek(seconds) {
        handler.current?.(seconds);
      },
    }),
    [],
  );

  return <PlayerSeekContext.Provider value={value}>{children}</PlayerSeekContext.Provider>;
}

/** The seek controls, or null outside a provider. */
export function usePlayerSeek(): PlayerSeekValue | null {
  return useContext(PlayerSeekContext);
}
