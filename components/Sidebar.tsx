"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "@apollo/client";
import { DELETE_CONVERSATION } from "@/lib/graphql/conversation";
import { useToast } from "@/components/Toaster";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

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
}

export default function Sidebar({ conversations, loading, activeId, onDeleted }: SidebarProps) {
  const [deleteConversation] = useMutation(DELETE_CONVERSATION);
  const { showError } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");
    } catch {
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
      }
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (deletingId) return;
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteConversation({ variables: { id } });
      await onDeleted(id);
    } catch (err) {
      showError(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className={`chat-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="chat-sidebar-top">
        {!collapsed && <div className="chat-sidebar-title">Conversations</div>}
        <button
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      {collapsed ? null : loading && conversations.length === 0 ? (
        <p className="empty-state sidebar-empty">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="empty-state sidebar-empty">No conversations yet.</p>
      ) : (
        <ul className="sidebar-list">
          {conversations.map((c) => (
            <li key={c.id} className={`sidebar-item ${c.id === activeId ? "active" : ""}`}>
              <Link href={`/chat/${c.id}`} className="sidebar-item-link">
                <div className="conv-title">{c.title || "New chat"}</div>
                <div className="conv-date">{new Date(c.updatedAt).toLocaleString()}</div>
              </Link>
              <button
                className="sidebar-delete"
                title="Delete conversation"
                aria-label="Delete conversation"
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
              >
                {deletingId === c.id ? "…" : "✕"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
