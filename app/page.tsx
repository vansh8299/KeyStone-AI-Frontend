"use client";

import { useEffect } from "react";
import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { ME } from "@/lib/graphql/auth";

export default function HomePage() {
  const router = useRouter();
  const { data, loading } = useQuery(ME, { fetchPolicy: "network-only" });

  useEffect(() => {
    if (loading) return;
    router.replace(data?.me ? "/chat" : "/login");
  }, [loading, data, router]);

  return null;
}