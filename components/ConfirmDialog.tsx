"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getErrorMessage } from "@/lib/errors";
import { ButtonLabel } from "@/components/Loader";

type Tone = "danger" | "warning" | "default";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Label shown on the confirm button while `onConfirm` runs. */
  busyLabel?: string;
  tone?: Tone;
  /**
   * Optional async work to run when confirmed. The dialog stays open with a spinner until it
   * settles, and shows the error inline if it throws so the user can retry or cancel.
   */
  onConfirm?: () => Promise<unknown>;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          prev?.resolve(false);
          return { ...options, resolve };
        });
      }),
    []
  );

  const close = useCallback((confirmed: boolean) => {
    setPending((prev) => {
      prev?.resolve(confirmed);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog key={pending.title} options={pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}

function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (confirmed: boolean) => void }) {
  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    busyLabel = "Working…",
    tone = "default",
    onConfirm,
  } = options;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Destructive dialogs focus Cancel so an accidental Enter doesn't confirm.
    cancelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  async function handleConfirm() {
    if (!onConfirm) {
      onClose(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busy) onClose(false);
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <div className="confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose(false)}>
      <div
        ref={dialogRef}
        className={`confirm-dialog confirm-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? "confirm-message" : undefined}
        onKeyDown={onKeyDown}
      >
        <div className="confirm-body">
          <span className="confirm-icon" aria-hidden="true">
            <ToneIcon tone={tone} />
          </span>
          <div className="confirm-text">
            <h2 id="confirm-title" className="confirm-title">
              {title}
            </h2>
            {message && (
              <div id="confirm-message" className="confirm-message">
                {message}
              </div>
            )}
            {error && (
              <div className="confirm-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="btn-ghost" onClick={() => onClose(false)} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-primary confirm-submit ${tone === "danger" ? "btn-solid-danger" : ""}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            <ButtonLabel loading={busy} loadingText={busyLabel}>
              {error ? "Try again" : confirmLabel}
            </ButtonLabel>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ToneIcon({ tone }: { tone: Tone }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (tone === "danger") {
    return (
      <svg {...common}>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
