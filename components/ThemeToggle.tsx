"use client";

import { useEffect, useState } from "react";
import { applyTheme, getSavedTheme, getTheme, saveTheme, systemTheme, type Theme } from "@/lib/theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getTheme());

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onSystemChange = () => {
      if (getSavedTheme()) return;
      const next = systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", onSystemChange);

    const onStorage = () => {
      const next = getSavedTheme() ?? systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  function toggle() {
    const next: Theme = getTheme() === "dark" ? "light" : "dark";
    saveTheme(next);
    setTheme(next);
  }

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={toggle} title={label} aria-label={label}>
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
