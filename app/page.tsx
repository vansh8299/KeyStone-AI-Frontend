"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/Loader";
import ServerUnavailable from "@/components/ServerUnavailable";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function HomePage() {
  const router = useRouter();
  // Signed-out visitors are sent to /login by the hook itself.
  const { status, retry } = useCurrentUser();

  useEffect(() => {
    if (status === "authenticated") router.replace("/chat");
  }, [status, router]);

  if (status === "error") return <ServerUnavailable onRetry={retry} />;
  return <PageLoader />;
}
