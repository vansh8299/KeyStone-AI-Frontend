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

const AUTH_PAGES = ["/login", "/signup", "/verify-email", "/forgot-password"];

export function redirectToLogin(reason: "expired" = "expired") {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  if (AUTH_PAGES.includes(pathname)) return;
  const next = encodeURIComponent(pathname + search);
  window.location.assign(`/login?reason=${reason}&next=${next}`);
}

export function safeNextPath(fallback = "/chat"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
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
