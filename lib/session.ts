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

const AUTH_PAGES = ["/login", "/signup"];

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
