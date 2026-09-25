"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@apollo/client";
import { usePathname, useRouter } from "next/navigation";
import { ME } from "@/lib/graphql/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

// Transient failures (backend restarting, network blip, 5xx) are retried before giving up.
const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * The signed-in user, plus a status that separates "the server says you're signed out" from
 * "we couldn't ask the server". Only the former redirects to /login: a failed request must never
 * look like a logout, or a correct login can bounce straight back to the login page.
 */
export function useCurrentUser({ redirectIfAnonymous = true }: { redirectIfAnonymous?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, error, refetch } = useQuery(ME, {
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const me = data?.me ?? null;
  const status: AuthStatus = me
    ? "authenticated" // keep showing the user even if a later refetch fails
    : loading
      ? "loading"
      : error
        ? "error"
        : "anonymous"; // the server answered, and there is no session

  const attempts = useRef(0);
  useEffect(() => {
    if (status === "authenticated") attempts.current = 0;
    if (status !== "error" || attempts.current >= RETRY_DELAYS_MS.length) return;
    const timer = setTimeout(() => {
      attempts.current += 1;
      refetch().catch(() => {});
    }, RETRY_DELAYS_MS[attempts.current]);
    return () => clearTimeout(timer);
  }, [status, refetch]);

  useEffect(() => {
    if (status !== "anonymous" || !redirectIfAnonymous) return;
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [status, redirectIfAnonymous, pathname, router]);

  /** Manual retry from the error screen; resets the automatic retry budget. */
  const retry = () => {
    attempts.current = 0;
    return refetch().catch(() => {});
  };

  return { me, status, refetch, retry };
}
