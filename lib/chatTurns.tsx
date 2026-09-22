"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApolloClient } from "@apollo/client";
import {
  streamAgent,
  resumeAgent,
  isConnectionError,
  type AgentDone,
  type AgentStatus,
  type AgentStreamHandlers,
  type AgentStreamRequest,
} from "./agentStream";
import { getErrorMessage } from "./errors";
import { ME } from "./graphql/auth";
import { CONVERSATION, GENERATE_CONVERSATION_TITLE } from "./graphql/conversation";
import { useToast } from "@/components/Toaster";

export interface ChatTurn {
  key: string;
  conversationId: string | null;
  content: string;
  status?: AgentStatus;
  attached: boolean;
  phase: "streaming" | "done" | "error";
  result?: AgentDone;
  error?: unknown;
}

interface ChatTurnsApi {
  start: (request: AgentStreamRequest, options?: { onConversation?: (conversationId: string) => void }) => void;
  resume: (conversationId: string) => void;
  turnFor: (conversationId: string | undefined) => ChatTurn | undefined;
  dismiss: (key: string) => void;
}

const ChatTurnsContext = createContext<ChatTurnsApi | null>(null);

const RECONNECT_DELAYS_MS = [1000, 2000, 4000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ChatTurnsProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const router = useRouter();
  const pathname = usePathname();
  const { showInfo, showError } = useToast();
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const update = useCallback((key: string, change: (t: ChatTurn) => ChatTurn) => {
    setTurns((prev) => prev.map((t) => (t.key === key ? change(t) : t)));
  }, []);
  const remove = useCallback((key: string) => {
    setTurns((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const refetchMe = useCallback(() => {
    client.refetchQueries({ include: [ME] }).catch(() => {});
  }, [client]);

  const isViewing = (conversationId: string | null) =>
    pathnameRef.current === (conversationId ? `/chat/${conversationId}` : "/chat");

  const titleOf = (conversationId: string | null): string | null => {
    if (!conversationId) return null;
    const me = client.readQuery<{ me: { conversations: { id: string; title: string | null }[] } | null }>({ query: ME });
    return me?.me?.conversations.find((c) => c.id === conversationId)?.title ?? null;
  };

  const openConversation = (conversationId: string | null) => {
    if (conversationId) router.push(`/chat/${conversationId}`);
  };

  const notifyInBackground = (title: string, body: string, conversationId: string | null) => {
    if (typeof document === "undefined" || !document.hidden) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const notification = new Notification(title, { body, tag: conversationId ?? undefined });
      notification.onclick = () => {
        window.focus();
        if (!isViewing(conversationId)) openConversation(conversationId);
        notification.close();
      };
    } catch {
    }
  };

  const finish = (key: string, outcome: { result?: AgentDone } | { error: unknown }) => {
    const turn = turnsRef.current.find((t) => t.key === key);
    if (!turn) return;
    const conversationId = turn.conversationId ?? ("result" in outcome ? outcome.result?.conversationId ?? null : null);
    const title = titleOf(conversationId);
    const where = title ? ` in “${title}”` : "";
    const failed = "error" in outcome;

    notifyInBackground(
      failed ? "The reply couldn't be finished" : "Your answer is ready",
      failed ? getErrorMessage(outcome.error) : title ?? "Open the chat to read it.",
      conversationId
    );

    if (isViewing(conversationId)) {
      update(key, (t) => ({ ...t, conversationId, phase: failed ? "error" : "done", ...outcome }));
      return;
    }
    remove(key);
    const action = conversationId ? { label: "Open", onClick: () => openConversation(conversationId) } : undefined;
    if (failed) showError(new Error(`The reply${where} couldn't be finished: ${getErrorMessage(outcome.error)}`), action);
    else showInfo(`Your answer${where} is ready.`, action);
  };

  const handlersFor = (key: string): AgentStreamHandlers & { reset: () => void } => ({
    reset: () => update(key, (t) => ({ ...t, content: "", status: undefined })),
    onConversation: () => update(key, (t) => ({ ...t, attached: true })),
    onToken: (text) => update(key, (t) => ({ ...t, attached: true, content: t.content + text })),
    onStatus: (status) => update(key, (t) => ({ ...t, attached: true, status })),
  });

  const settleFromServer = async (key: string, conversationId: string, originalError: unknown) => {
    try {
      const { data } = await client.query<{ conversation: { messages: { role: string }[] } | null }>({
        query: CONVERSATION,
        variables: { id: conversationId },
        fetchPolicy: "network-only",
      });
      const messages = data?.conversation?.messages ?? [];
      const last = messages[messages.length - 1];
      if (last?.role === "ASSISTANT") return finish(key, {});
    } catch {
    }
    finish(key, { error: isConnectionError(originalError) ? new Error("The connection was lost before the reply finished. Please try again.") : originalError });
  };

  const reconnect = async (key: string, conversationId: string, originalError: unknown) => {
    const handlers = handlersFor(key);
    for (const delay of RECONNECT_DELAYS_MS) {
      await sleep(delay);
      if (!turnsRef.current.some((t) => t.key === key)) return;
      try {
        handlers.reset();
        const result = await resumeAgent(conversationId, handlers);
        if (result) return finish(key, { result });
        return settleFromServer(key, conversationId, originalError);
      } catch (err) {
        if (!isConnectionError(err)) return finish(key, { error: err });
      }
    }
    settleFromServer(key, conversationId, originalError);
  };

  const start: ChatTurnsApi["start"] = (request, options = {}) => {
    const key = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isNewChat = !request.conversationId;
    let conversationId = request.conversationId ?? null;
    const turn: ChatTurn = { key, conversationId, content: "", attached: true, phase: "streaming" };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns((prev) => [...prev, turn]);

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    streamAgent(request, {
      ...handlersFor(key),
      onConversation: (id) => {
        conversationId = id;
        update(key, (t) => ({ ...t, conversationId: id }));
        if (!isNewChat) return;
        options.onConversation?.(id);
        if (pathnameRef.current === "/chat") router.replace(`/chat/${id}`);
        refetchMe();
      },
    })
      .then((result) => {
        finish(key, { result });
        refetchMe();
        if (isNewChat) {
          client
            .mutate({ mutation: GENERATE_CONVERSATION_TITLE, variables: { id: result.conversationId } })
            .then(() => refetchMe())
            .catch(() => {
            });
        }
      })
      .catch((err) => {
        if (conversationId && isConnectionError(err)) return reconnect(key, conversationId, err);
        finish(key, { error: err });
        if (isNewChat && conversationId) refetchMe();
      });
  };

  const resume: ChatTurnsApi["resume"] = (conversationId) => {
    if (turnsRef.current.some((t) => t.conversationId === conversationId)) return;
    const key = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const turn: ChatTurn = { key, conversationId, content: "", attached: false, phase: "streaming" };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns((prev) => [...prev, turn]);

    resumeAgent(conversationId, handlersFor(key))
      .then((result) => {
        if (result) {
          finish(key, { result });
          refetchMe();
        } else {
          remove(key);
        }
      })
      .catch((err) => {
        const attached = turnsRef.current.find((t) => t.key === key)?.attached;
        if (!attached) return remove(key);
        if (isConnectionError(err)) return reconnect(key, conversationId, err);
        finish(key, { error: err });
      });
  };

  const api = useMemo<ChatTurnsApi>(
    () => ({
      start,
      resume,
      turnFor: (conversationId) => turns.find((t) => t.conversationId === (conversationId ?? null)),
      dismiss: remove,
    }),
    [turns]
  );

  return <ChatTurnsContext.Provider value={api}>{children}</ChatTurnsContext.Provider>;
}

export function useChatTurns(): ChatTurnsApi {
  const api = useContext(ChatTurnsContext);
  if (!api) throw new Error("useChatTurns must be used inside <ChatTurnsProvider>");
  return api;
}
