import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SIGNED_IN_PATH, isGuestOnlyPath, isProtectedPath, safeNext, SESSION_HINT_COOKIE } from "@/lib/routes";

/**
 * Routes before any page renders, so nobody sees a flash of the wrong screen:
 * - `/` goes to the chat when signed in, otherwise to /login;
 * - app pages (/chat, /knowledge-base) send signed-out visitors to /login?next=…;
 * - sign-in pages send signed-in users on to the app.
 * "Signed in" here is the frontend's hint cookie (see SESSION_HINT_COOKIE); the API enforces the
 * real session, and the in-page guards fix the hint if it's stale.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const signedIn = request.cookies.get(SESSION_HINT_COOKIE)?.value === "1";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (pathname === "/") return to(signedIn ? DEFAULT_SIGNED_IN_PATH : "/login");
  if (isProtectedPath(pathname) && !signedIn) return to(`/login?next=${encodeURIComponent(pathname + search)}`);
  if (isGuestOnlyPath(pathname) && signedIn) return to(safeNext(request.nextUrl.searchParams.get("next")));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/chat/:path*", "/knowledge-base/:path*", "/login", "/signup", "/verify-email", "/forgot-password"],
};
