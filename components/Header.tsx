"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { LOGOUT } from "@/lib/graphql/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { useConfirm } from "@/components/ConfirmDialog";

interface HeaderProps {
  active: "chat" | "knowledge-base";
  /** Chat page only: toggles the conversations drawer on small screens. */
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export default function Header({ active, onMenuClick, menuOpen = false }: HeaderProps) {
  const router = useRouter();
  const [logout] = useMutation(LOGOUT);
  const confirm = useConfirm();

  async function handleLogout() {
    const confirmed = await confirm({
      title: "Log out of Keystone AI?",
      message: "You'll need to sign in again to get back to your conversations and knowledge base.",
      confirmLabel: "Log out",
      busyLabel: "Logging out…",
      tone: "warning",
      onConfirm: () => logout(),
    });
    if (confirmed) router.push("/login");
  }

  return (
    <header className="dashboard-header">
      <div className="header-start">
        {onMenuClick && (
          <button
            type="button"
            className="header-menu-btn"
            onClick={onMenuClick}
            aria-label={menuOpen ? "Close conversations" : "Open conversations"}
            aria-expanded={menuOpen}
            aria-controls="chat-sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Link href="/chat" className="brand" aria-label="Keystone AI home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">Keystone AI</span>
        </Link>
      </div>
      <nav className="nav-links" aria-label="Main">
        <Link
          href="/knowledge-base"
          className={active === "knowledge-base" ? "active" : ""}
          aria-current={active === "knowledge-base" ? "page" : undefined}
        >
          <span className="label-full">Knowledge base</span>
          <span className="label-short">Docs</span>
        </Link>
        <Link href="/chat" className={active === "chat" ? "active" : ""} aria-current={active === "chat" ? "page" : undefined}>
          Chat
        </Link>
      </nav>
      <div className="header-actions">
        <Link href="/chat" className="btn-ghost header-new-chat" title="New chat" aria-label="New chat">
          <span aria-hidden="true">+</span>
          <span className="label-full"> New chat</span>
        </Link>
        <button className="btn-ghost header-logout" onClick={handleLogout} title="Log out" aria-label="Log out">
          <svg className="label-short" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="label-full">Log out</span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
