"use client";

import { createContext, useContext, useMemo, useRef } from "react";

type SeekHandler = (seconds: number) => void;

interface PlayerSeekValue {
  register: (handler: SeekHandler) => () => void;
  seek: (seconds: number) => void;
}

const PlayerSeekContext = createContext<PlayerSeekValue | null>(null);

export function PlayerSeekProvider({ children }: { children: React.ReactNode }) {
  const handler = useRef<SeekHandler | null>(null);

  const value = useMemo<PlayerSeekValue>(
    () => ({
      register(next) {
        handler.current = next;

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

export function usePlayerSeek(): PlayerSeekValue | null {
  return useContext(PlayerSeekContext);
}
