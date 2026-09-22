"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

type ToastKind = "error" | "info";

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
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
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
              ×
            </button>
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
