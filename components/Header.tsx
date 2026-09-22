"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { LOGOUT } from "@/lib/graphql/auth";
import ThemeToggle from "@/components/ThemeToggle";

interface HeaderProps {
  active: "chat" | "knowledge-base";
  showChatActions?: boolean;
}

export default function Header({ active, showChatActions = false }: HeaderProps) {
  const router = useRouter();
  const [logout] = useMutation(LOGOUT);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="dashboard-header">
      <span className="brand">Keystone AI</span>
      <nav className="nav-links">
        <Link href="/knowledge-base" className={active === "knowledge-base" ? "active" : ""}>
          Knowledge base
        </Link>
        <Link href="/chat" className={active === "chat" ? "active" : ""}>
          Chat
        </Link>
      </nav>
      <div className="header-actions">
        {showChatActions && (
          <>
            <Link href="/chat" className="btn-ghost">
              + New chat
            </Link>
            <button className="btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
