"use client";

import { useEffect, useState } from "react";

/** A countdown in whole seconds, e.g. for "Resend code in 42s". `start(n)` (re)starts it. */
export function useCooldown(initialSeconds = 0) {
  const [endsAt, setEndsAt] = useState(() => (initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), 250);
    return () => clearTimeout(timer);
  }, [endsAt, now]);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const start = (seconds: number) => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + seconds * 1000);
  };
  return { remaining, start };
}
