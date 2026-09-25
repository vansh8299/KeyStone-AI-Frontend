"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

type ToastKind = "error" | "info" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  showError: (error: unknown, action?: ToastAction) => void;
  showInfo: (message: string, action?: ToastAction) => void;
  showSuccess: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_AFTER_MS = 6000;
const DISMISS_WITH_ACTION_AFTER_MS = 12000;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.filter((t) => t.message !== message), { id, kind, message, action }].slice(-MAX_VISIBLE));
      timers.current.set(id, setTimeout(() => dismiss(id), action ? DISMISS_WITH_ACTION_AFTER_MS : DISMISS_AFTER_MS));
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const api: ToastApi = {
    showError: useCallback((error: unknown, action?: ToastAction) => push("error", getErrorMessage(error), action), [push]),
    showInfo: useCallback((message: string, action?: ToastAction) => push("info", message, action), [push]),
    showSuccess: useCallback((message: string, action?: ToastAction) => push("success", message, action), [push]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
            <span className="toast-icon" aria-hidden="true">
              <ToastIcon kind={t.kind} />
            </span>
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action?.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <span
              className="toast-timer"
              style={{ animationDuration: `${t.action ? DISMISS_WITH_ACTION_AFTER_MS : DISMISS_AFTER_MS}ms` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {kind === "success" ? (
        <path d="M20 6 9 17l-5-5" />
      ) : kind === "error" ? (
        <path d="M12 8v5M12 16.5h.01" />
      ) : (
        <path d="M12 16v-4M12 8h.01" />
      )}
    </svg>
  );
}
