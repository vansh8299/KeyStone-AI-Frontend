"use client";

import { useState } from "react";
import { ButtonLabel } from "@/components/Loader";

/** Full-page state for when the session check itself failed (not the same as being signed out). */
export default function ServerUnavailable({ onRetry }: { onRetry: () => Promise<unknown> }) {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="server-unavailable" role="alert">
      <span className="server-unavailable-icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2l20 20M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.7M1.4 9a15 15 0 0 1 4.2-2.6M22.6 9a15 15 0 0 0-11.4-4M12 20h.01" />
        </svg>
      </span>
      <h1 className="server-unavailable-title">Can&apos;t reach Keystone AI</h1>
      <p className="server-unavailable-text">
        The server didn&apos;t respond, so we couldn&apos;t load your account. Check your connection and try again.
      </p>
      <button type="button" className="btn-primary server-unavailable-retry" onClick={retry} disabled={retrying}>
        <ButtonLabel loading={retrying} loadingText="Retrying…">Try again</ButtonLabel>
      </button>
    </main>
  );
}
