export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export const themeInitScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export function getTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function getSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
  }
}
