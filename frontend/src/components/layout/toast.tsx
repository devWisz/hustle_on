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
import { CheckIcon, CloseIcon, SpinnerIcon } from "../ui/icons";
import { cx } from "@/lib/format";

// "info" is for a request that succeeded without changing anything — a re-check
// the chain has not finalized yet, a job already done. Reporting those as an error
// teaches people to ignore the red ones.
type ToastTone = "success" | "info" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;

  success: (message: string) => void;
  info: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

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

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      toast,
      success: (message: string) => toast(message, "success"),
      info: (message: string) => toast(message, "info"),
      error: (message: string) => toast(message, "error"),
    }),
    [toast],
  );

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
            className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-inverse px-4 py-3 text-inverse-fg shadow-[var(--shadow-lifted)]"
          >
            <span
              className={cx(
                "shrink-0",
                item.tone === "error" ? "text-danger" : item.tone === "info" ? "" : "text-success",
              )}
            >
              {item.tone === "error" ? (
                <CloseIcon size={16} />
              ) : item.tone === "info" ? (
                <SpinnerIcon size={16} />
              ) : (
                <CheckIcon size={16} />
              )}
            </span>
            <p className="flex-1 text-[13px] leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="-m-1 shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
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

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => {}, success: () => {}, error: () => {} };
}
