"use client";

import { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { ME } from "@/lib/graphql/auth";
import { markSignedIn, markSignedOut, safeNextPath } from "@/lib/session";

/**
 * Guard for pages only signed-out visitors should use (login, sign-up, verification, password
 * reset). The middleware already redirects when its hint says "signed in"; this catches a valid
 * session the hint doesn't know about (e.g. it was cleared) by asking the API, then moves on to
 * the app. It never blocks the form: signed-out visitors see the page straight away.
 */
export function useGuestOnly() {
  const router = useRouter();
  const { data } = useQuery(ME, { fetchPolicy: "network-only" });
  const signedIn = Boolean(data?.me);
  // Only an explicit answer counts as signed out — not an emptied cache (logging in clears it).
  const signedOut = data?.me === null;

  useEffect(() => {
    if (signedIn) {
      markSignedIn();
      router.replace(safeNextPath());
    } else if (signedOut) {
      markSignedOut(); // the API says there's no session: drop a stale hint
    }
  }, [signedIn, signedOut, router]);

  return { redirecting: signedIn };
}
