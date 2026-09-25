"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useMutation } from "@apollo/client";
import { DELETE_CONVERSATION } from "@/lib/graphql/conversation";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { SkeletonList, Spinner } from "@/components/Loader";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

// The collapsed preference lives in localStorage, so it's read as an external store rather than
// copied into state from an effect. Falls back to memory when storage is unavailable (private mode).
const collapsedListeners = new Set<() => void>();
let collapsedInMemory = false;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return collapsedInMemory;
  }
}

function writeCollapsed(value: boolean) {
  collapsedInMemory = value;
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(value));
  } catch {
  }
  collapsedListeners.forEach((notify) => notify());
}

function subscribeCollapsed(notify: () => void) {
  collapsedListeners.add(notify);
  // Keeps other open tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key === COLLAPSED_STORAGE_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    collapsedListeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface SidebarProps {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId?: string;
  onDeleted: (id: string) => void | Promise<unknown>;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({
  conversations,
  loading,
  activeId,
  onDeleted,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [deleteConversation] = useMutation(DELETE_CONVERSATION);
  const { showSuccess } = useToast();
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Server render is always expanded; the client snapshot takes over after hydration.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  useEffect(() => {
    if (!mobileOpen || !onMobileClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  function toggleCollapsed() {
    writeCollapsed(!collapsed);
  }

  async function handleDelete(conversation: ConversationSummary) {
    if (deletingId) return;
    const { id } = conversation;
    const deleted = await confirm({
      title: "Delete conversation?",
      message: (
        <>
          <strong>{conversation.title || "New chat"}</strong> and all of its messages will be permanently
          deleted. This can&apos;t be undone.
        </>
      ),
      confirmLabel: "Delete",
      busyLabel: "Deleting…",
      tone: "danger",
      onConfirm: async () => {
        setDeletingId(id);
        try {
          await deleteConversation({ variables: { id } });
        } finally {
          setDeletingId(null);
        }
      },
    });
    if (!deleted) return;
    showSuccess("Conversation deleted");
    await onDeleted(id);
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onMobileClose} aria-hidden="true" />}
      <aside
        id="chat-sidebar"
        className={`chat-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
      >
        <div className="chat-sidebar-top">
          <div className="chat-sidebar-title">Conversations</div>
          <button
            className="sidebar-toggle"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? "»" : "«"}
          </button>
          <button className="sidebar-toggle sidebar-close" onClick={onMobileClose} aria-label="Close conversations">
            ✕
          </button>
        </div>
        <Link href="/chat" className="btn-ghost sidebar-new-chat" onClick={onMobileClose}>
          + New chat
        </Link>
        {loading && conversations.length === 0 ? (
          <SkeletonList rows={6} />
        ) : conversations.length === 0 ? (
          <p className="empty-state sidebar-empty">No conversations yet.</p>
        ) : (
          <ul className="sidebar-list">
            {conversations.map((c) => (
              <li key={c.id} className={`sidebar-item ${c.id === activeId ? "active" : ""}`}>
                <Link href={`/chat/${c.id}`} className="sidebar-item-link" onClick={onMobileClose}>
                  <div className="conv-title">{c.title || "New chat"}</div>
                  <div className="conv-date">{new Date(c.updatedAt).toLocaleString()}</div>
                </Link>
                <button
                  className="sidebar-delete"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                  onClick={() => handleDelete(c)}
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? <Spinner size={12} /> : "✕"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  );
}
