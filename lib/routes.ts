/**
 * Which pages need a signed-in user and which are only for signed-out visitors. Shared by the
 * middleware (server-side redirects before a page renders) and the in-page guards.
 */

/**
 * A routing hint on the frontend's own domain: "this browser is probably signed in". The real
 * session cookies belong to the API's domain, which the frontend server can't read when the two
 * are deployed separately, so the middleware routes on this instead. It's never trusted for
 * access — the API checks the real session on every request, and the in-page guards correct the
 * hint whenever it's wrong.
 */
export const SESSION_HINT_COOKIE = "ks_signed_in";

const PROTECTED_PREFIXES = ["/chat", "/knowledge-base"];
const GUEST_ONLY_PATHS = ["/login", "/signup", "/verify-email", "/forgot-password"];

export const DEFAULT_SIGNED_IN_PATH = "/chat";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isGuestOnlyPath(pathname: string): boolean {
  return GUEST_ONLY_PATHS.includes(pathname);
}

/**
 * Where to go after signing in: the `next` path if it's a same-origin page worth returning to,
 * otherwise the default. Guest-only pages are never a destination (that would bounce straight back).
 */
export function safeNext(next: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  const pathname = next.split(/[?#]/)[0];
  return isGuestOnlyPath(pathname) ? fallback : next;
}
