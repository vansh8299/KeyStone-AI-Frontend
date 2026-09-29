"use client";

import { useEffect, useState } from "react";

/**
 * Reveals streamed text progressively. The model (Groq) can produce a whole answer in ~100 ms,
 * which reads as "appeared at once" even though it streamed; this types it out over roughly a
 * second instead — fast when far behind, easing off as it catches up. While `active` is false
 * (a saved message) the text is shown in full. Text that shrinks (the draft was withdrawn) is
 * followed immediately.
 */
export function useSmoothText(text: string, active: boolean): string {
  const [shown, setShown] = useState(active ? 0 : text.length);
  const visible = Math.min(shown, text.length);

  useEffect(() => {
    if (!active) return;
    const remaining = text.length - visible;
    if (remaining <= 0) return;
    // A timer rather than requestAnimationFrame, which stops entirely while the page isn't painted.
    const timer = setTimeout(() => setShown(visible + Math.max(3, Math.ceil(remaining / 25))), 16);
    return () => clearTimeout(timer);
  }, [text, active, visible]);

  return active ? text.slice(0, visible) : text;
}
