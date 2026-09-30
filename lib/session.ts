import { DEFAULT_SIGNED_IN_PATH, isGuestOnlyPath, safeNext, SESSION_HINT_COOKIE } from "./routes";

// lib/session.ts (the fallback default is also missing it)
export const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql";
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  inFlight ??= fetch(GRAPHQL_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "mutation RefreshToken { refreshToken { user { id } } }" }),
  })
    .then(async (res) => {
      const body = await res.json().catch(() => null);
      return Boolean(body?.data?.refreshToken?.user?.id);
    })
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const SESSION_HINT_MAX_AGE_S = 30 * 24 * 60 * 60; // matches the refresh token's lifetime

function writeSessionHint(value: string, maxAgeS: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_HINT_COOKIE}=${value}; Path=/; Max-Age=${maxAgeS}; SameSite=Lax${secure}`;
}

/** Tells the middleware this browser is signed in (see SESSION_HINT_COOKIE). */
export function markSignedIn() {
  writeSessionHint("1", SESSION_HINT_MAX_AGE_S);
}

/** Tells the middleware this browser is signed out. Always call before navigating to /login. */
export function markSignedOut() {
  writeSessionHint("", 0);
}

export function redirectToLogin(reason: "expired" = "expired") {
  if (typeof window === "undefined") return;
  markSignedOut();
  const { pathname, search } = window.location;
  if (isGuestOnlyPath(pathname)) return;
  const next = encodeURIComponent(pathname + search);
  window.location.assign(`/login?reason=${reason}&next=${next}`);
}

export function safeNextPath(fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (typeof window === "undefined") return fallback;
  return safeNext(new URLSearchParams(window.location.search).get("next"), fallback);
}

// The address awaiting verification is handed from sign-up / login to /verify-email through
// sessionStorage rather than the URL, so it doesn't end up in history, logs or referrers.
const PENDING_EMAIL_KEY = "pendingVerificationEmail";

export function setPendingVerificationEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Storage unavailable: the verify page asks for the email instead.
  }
}

export function getPendingVerificationEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingVerificationEmail() {
  try {
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Nothing to clear.
  }
}
