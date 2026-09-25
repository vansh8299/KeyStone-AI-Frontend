"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, getSavedTheme, getTheme, saveTheme, systemTheme, type Theme } from "@/lib/theme";

// The theme's source of truth is the data-theme attribute on <html> (set before hydration by
// themeInitScript), so the toggle subscribes to it rather than copying it into state.
function subscribeTheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Follow the OS setting until the user picks a theme explicitly.
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onSystemChange = () => {
    if (!getSavedTheme()) applyTheme(systemTheme());
  };
  media.addEventListener("change", onSystemChange);

  // A theme picked in another tab.
  const onStorage = () => applyTheme(getSavedTheme() ?? systemTheme());
  window.addEventListener("storage", onStorage);

  return () => {
    observer.disconnect();
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server: the real theme is only known in the browser.
  const theme = useSyncExternalStore<Theme | null>(subscribeTheme, getTheme, () => null);

  function toggle() {
    saveTheme(getTheme() === "dark" ? "light" : "dark");
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
