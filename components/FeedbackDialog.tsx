"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from "@/lib/graphql/feedback";

const REASON_MAX_CHARS = 2000;

interface FeedbackDialogProps {
  initialCategories?: FeedbackCategory[];
  initialReason?: string | null;
  saving: boolean;
  error: string | null;
  onSubmit: (categories: FeedbackCategory[], reason: string) => void;
  onSkip: () => void;
}

export default function FeedbackDialog({
  initialCategories = [],
  initialReason,
  saving,
  error,
  onSubmit,
  onSkip,
}: FeedbackDialogProps) {
  const [categories, setCategories] = useState<FeedbackCategory[]>(initialCategories);
  const [reason, setReason] = useState(initialReason ?? "");
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstFocusRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onSkip();
      return;
    }
    if (e.key === "Tab" && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), textarea:not(:disabled)"
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function toggle(category: FeedbackCategory) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }

  const hasDetails = categories.length > 0 || reason.trim().length > 0;

  return createPortal(
    <div className="feedback-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onSkip()}>
      <div
        ref={dialogRef}
        className="feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        aria-describedby="feedback-desc"
        onKeyDown={onKeyDown}
      >
        <h2 id="feedback-title" className="feedback-title">
          What went wrong?
        </h2>
        <p id="feedback-desc" className="feedback-desc">
          Optional — your dislike is already saved. Tell us more to help improve the answers.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (hasDetails) onSubmit(categories, reason.trim());
            else onSkip();
          }}
        >
          <div className="feedback-chips" role="group" aria-label="Reasons">
            {FEEDBACK_CATEGORIES.map((c, i) => {
              const selected = categories.includes(c.value);
              return (
                <button
                  key={c.value}
                  ref={i === 0 ? firstFocusRef : undefined}
                  type="button"
                  className={`feedback-chip ${selected ? "selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => toggle(c.value)}
                  disabled={saving}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <label htmlFor="feedback-reason" className="feedback-label">
            Anything else? <span className="feedback-optional">(optional)</span>
          </label>
          <textarea
            id="feedback-reason"
            className="feedback-reason"
            rows={4}
            maxLength={REASON_MAX_CHARS}
            placeholder="What was wrong with this response? What would have been better?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={saving}
          />
          {reason.length > REASON_MAX_CHARS * 0.9 && (
            <div className="feedback-count">
              {reason.length}/{REASON_MAX_CHARS}
            </div>
          )}

          {error && (
            <div className="error-banner feedback-error" role="alert">
              {error}
            </div>
          )}

          <div className="feedback-actions">
            <button type="button" className="btn-ghost" onClick={onSkip} disabled={saving}>
              Skip
            </button>
            <button type="submit" className="btn-primary feedback-submit" disabled={saving || !hasDetails}>
              {saving ? "Sending…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
