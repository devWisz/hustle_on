"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, CloseIcon } from "./icons";
import { cx } from "@/lib/format";

/**
 * Transient confirmations.
 *
 * A toast is for something that already succeeded and needs no decision — a
 * link copied, a preference saved. Anything the person must act on belongs in
 * the page, not here, because a message that disappears on a timer is a message
 * some people will never finish reading.
 *
 * The live region is polite and always present in the DOM: a region inserted at
 * the same moment as its first message is frequently missed by screen readers.
 */

type ToastTone = "success" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Duration a toast stays on screen. Long enough to read a short sentence. */
const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Clearing on unmount stops a timer firing setState against a gone tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cx(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[var(--radius-card)]",
              "border bg-surface px-3.5 py-3 shadow-[var(--shadow-raised)]",
              item.tone === "error" ? "border-danger/40" : "border-border",
            )}
          >
            <span
              className={cx(
                "mt-px shrink-0",
                item.tone === "error" ? "text-danger" : "text-accent",
              )}
            >
              {item.tone === "error" ? (
                <CloseIcon size={16} />
              ) : (
                <CheckIcon size={16} />
              )}
            </span>
            <p className="flex-1 text-[13px] leading-relaxed">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="-m-1 shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-fg"
              aria-label="Dismiss"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns the toast function.
 *
 * Outside a provider this is a no-op rather than a thrown error: a missing
 * confirmation is a far smaller failure than a component tree that will not
 * render, and it keeps these components usable in isolation.
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => {} };
}
