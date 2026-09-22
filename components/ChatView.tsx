"use client";

import { useEffect, useRef, useState } from "react";
import { useApolloClient, useMutation, useQuery } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { type AgentStatus, type AgentStreamRequest } from "@/lib/agentStream";
import { useChatTurns } from "@/lib/chatTurns";
import { getErrorMessage } from "@/lib/errors";
import {
  CONVERSATION,
  REWIND_CONVERSATION,
  SWITCH_BRANCH,
} from "@/lib/graphql/conversation";
import { ME } from "@/lib/graphql/auth";
import Header from "@/components/Header";
import MarkdownMessage from "@/components/MarkdownMessage";
import Sidebar, { type ConversationSummary } from "@/components/Sidebar";
import {
  MessageAttachments,
  PendingAttachments,
  usePendingAttachments,
  type MessageAttachmentView,
} from "@/components/Attachments";
import { attachmentUrl } from "@/lib/fileUpload";
import AttachMenu from "@/components/AttachMenu";
import FeedbackDialog from "@/components/FeedbackDialog";
import CopyButton from "@/components/CopyButton";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { useToast } from "@/components/Toaster";
import {
  SET_MESSAGE_FEEDBACK,
  type FeedbackCategory,
  type FeedbackRating,
  type MessageFeedback,
} from "@/lib/graphql/feedback";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  error?: boolean;
  clarification?: "pending" | "resolved";
  streaming?: boolean;
  status?: AgentStatus;
  local?: boolean;
  siblingIds?: string[];
  feedback?: MessageFeedback | null;
  attachments?: MessageAttachmentView[];
}

interface ServerConversation {
  id: string;
  isRewound: boolean;
  messages: {
    id: string;
    role: string;
    content: string;
    siblingIds: string[];
    metadata?: {
      toolsUsed?: string[];
      hitl?: { status?: "pending" | "resolved" };
      attachments?: {
        id: string;
        kind?: "image" | "document";
        filename: string;
        parsedText?: string;
        summary?: string | null;
        pageCount?: number | null;
      }[];
    };
    feedback?: MessageFeedback | null;
  }[];
}

const TOOL_LABELS: Record<string, string> = {
  search_documents: "Knowledge base",
  llm_knowledge: "LLM knowledge",
  tavily_search: "Web search",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  CHECKING_ANSWER: "Checking answer…",
  IMPROVING_ANSWER: "Improving answer…",
};

function toChatMessages(conversation: ServerConversation): ChatMessage[] {
  return conversation.messages.map((m) => ({
    id: m.id,
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
    toolsUsed: m.metadata?.toolsUsed,
    clarification: m.metadata?.hitl?.status,
    siblingIds: m.siblingIds,
    feedback: m.feedback ?? null,
    attachments: m.metadata?.attachments?.map((a) => ({
      id: a.id,
      kind: a.kind ?? "image",
      src: attachmentUrl(a.id),
      filename: a.filename,
      parsedText: a.parsedText,
      summary: a.summary ?? undefined,
      pageCount: a.pageCount,
    })),
  }));
}

export default function ChatView() {
  const router = useRouter();
  const client = useApolloClient();
  const params = useParams<{ conversationId?: string[] }>();
  const conversationId = params.conversationId?.[0];

  const {
    data: meData,
    loading: meLoading,
    refetch: refetchMe,
  } = useQuery(ME, { fetchPolicy: "network-only" });
  const [switchBranch] = useMutation(SWITCH_BRANCH);
  const [rewindConversation] = useMutation(REWIND_CONVERSATION);
  const [setMessageFeedback] = useMutation(SET_MESSAGE_FEEDBACK);
  const { showError, showInfo } = useToast();
  const [feedbackDialog, setFeedbackDialog] = useState<{ messageId: string; saving: boolean; error: string | null } | null>(null);
  const chatTurns = useChatTurns();
  const turn = chatTurns.turnFor(conversationId);
  const streaming = Boolean(turn?.attached);
  const [navigating, setNavigating] = useState(false);
  const busy = streaming || navigating;

  const loadedConversationIdRef = useRef<string | undefined>(undefined);

  const { data: convoData, loading: convoLoading, error: convoError } = useQuery(CONVERSATION, {
    variables: { id: conversationId },
    skip: !conversationId || loadedConversationIdRef.current === conversationId,
    fetchPolicy: "network-only",
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRewound, setIsRewound] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingFiles = usePendingAttachments();
  const [draggingFiles, setDraggingFiles] = useState(false);

  const dictationBase = useRef("");
  const speech = useSpeechRecognition({
    onTranscript: (finalText, interimText) => {
      const spoken = (finalText + interimText).trim();
      const base = dictationBase.current.trimEnd();
      setInput(base && spoken ? `${base} ${spoken}` : base || spoken);
    },
  });

  function toggleDictation() {
    if (speech.listening) {
      speech.stop();
    } else {
      dictationBase.current = input;
      speech.start();
    }
  }
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meLoading && !meData?.me) {
      router.replace("/login");
    }
  }, [meLoading, meData, router]);

  function showConversation(conversation: ServerConversation) {
    setMessages(toChatMessages(conversation));
    setIsRewound(conversation.isRewound);
    setEditing(null);
  }

  useEffect(() => {
    if (!conversationId) {
      if (loadedConversationIdRef.current !== undefined) {
        loadedConversationIdRef.current = undefined;
        setMessages([]);
        setIsRewound(false);
        setEditing(null);
      }
      return;
    }
    if (loadedConversationIdRef.current === conversationId) return;

    if (convoData?.conversation?.id === conversationId) {
      loadedConversationIdRef.current = conversationId;
      showConversation(convoData.conversation);
      const last = convoData.conversation.messages[convoData.conversation.messages.length - 1];
      if (last?.role === "USER") chatTurns.resume(conversationId);
    }
  }, [conversationId, convoData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? "auto" : "smooth" });
  }, [messages, streaming, turn?.content]);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  function updateMessage(id: string, update: (m: ChatMessage) => ChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === id ? update(m) : m)));
  }

  async function reloadConversation(id: string): Promise<boolean> {
    try {
      const { data } = await client.query({
        query: CONVERSATION,
        variables: { id },
        fetchPolicy: "network-only",
      });
      if (loadedConversationIdRef.current !== id || !data?.conversation) return false;
      showConversation(data.conversation);
      return true;
    } catch {
      return false;
    }
  }

  function runTurn(
    request: AgentStreamRequest,
    keepCount: number,
    userContent?: string,
    userAttachments?: MessageAttachmentView[]
  ) {
    if (busy) return;
    setActionError(null);

    setMessages((prev) => [
      ...prev
        .slice(0, keepCount)
        .map((m) =>
          !request.editMessageId && !request.regenerateMessageId && m.clarification === "pending"
            ? { ...m, clarification: "resolved" as const }
            : m
        ),
      ...(userContent !== undefined
        ? [{ id: `u-${Date.now()}`, role: "user" as const, content: userContent, attachments: userAttachments, local: true }]
        : []),
    ]);
    setEditing(null);
    setIsRewound(false);

    chatTurns.start(
      { ...request, conversationId },
      {
        onConversation: (id) => {
          if (!conversationIdRef.current) loadedConversationIdRef.current = id;
        },
      }
    );
  }

  useEffect(() => {
    if (!turn || turn.phase === "streaming") return;
    chatTurns.dismiss(turn.key);
    const id = turn.conversationId;

    if (turn.phase === "done") {
      const { result } = turn;
      if (result) {
        setMessages((prev) => [
          ...prev,
          {
            id: turn.key,
            role: "assistant",
            content: result.answer,
            toolsUsed: result.toolsUsed,
            clarification: result.needsHumanInput ? "pending" : undefined,
            local: true,
          },
        ]);
      }
      if (id) reloadConversation(id);
      return;
    }

    const errorMessage: ChatMessage = {
      id: turn.key,
      role: "assistant",
      content: getErrorMessage(turn.error),
      error: true,
      local: true,
    };
    (id ? reloadConversation(id) : Promise.resolve(false)).then(() =>
      setMessages((prev) => [...prev, errorMessage])
    );
  }, [turn]);

  const shownMessages: ChatMessage[] =
    turn?.attached && turn.phase === "streaming"
      ? [...messages, { id: turn.key, role: "assistant", content: turn.content, status: turn.status, streaming: true, local: true }]
      : messages;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (speech.listening) speech.cancel();
    const question = input.trim();
    if (busy || pendingFiles.uploading || (!question && pendingFiles.readyCount === 0)) return;
    const { ids, shown } = pendingFiles.takeReady();
    setInput("");
    runTurn(
      { question, ...(ids.length > 0 ? { attachmentIds: ids } : {}) },
      messages.length,
      question,
      shown
    );
  }

  function handleEditSave(index: number) {
    const question = editing?.text.trim() ?? "";
    const original = messages[index];
    const hasFiles = (original.attachments?.length ?? 0) > 0;
    if (!editing || (!question && !hasFiles) || busy) return;
    if (question === original.content) {
      setEditing(null);
      return;
    }
    runTurn({ question, editMessageId: original.id }, index, question, original.attachments);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    pendingFiles.addFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingFiles(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) pendingFiles.addFiles(files);
  }

  async function handleFeedback(message: ChatMessage, rating: FeedbackRating) {
    const previous = message.feedback ?? null;
    const next: MessageFeedback | null =
      previous?.rating === rating ? null : { rating, categories: [], reason: null };
    updateMessage(message.id, (m) => ({ ...m, feedback: next }));
    if (next?.rating === "DISLIKE") setFeedbackDialog({ messageId: message.id, saving: false, error: null });

    try {
      await setMessageFeedback({ variables: { messageId: message.id, rating: next?.rating ?? null } });
    } catch (err) {
      updateMessage(message.id, (m) => ({ ...m, feedback: previous }));
      setFeedbackDialog((d) => (d?.messageId === message.id ? null : d));
      showError(err);
    }
  }

  async function submitDislikeReason(categories: FeedbackCategory[], reason: string) {
    if (!feedbackDialog) return;
    const { messageId } = feedbackDialog;
    setFeedbackDialog({ messageId, saving: true, error: null });
    try {
      const { data } = await setMessageFeedback({
        variables: { messageId, rating: "DISLIKE", categories, reason: reason || null },
      });
      updateMessage(messageId, (m) => ({ ...m, feedback: data?.setMessageFeedback?.feedback ?? m.feedback }));
      setFeedbackDialog(null);
      showInfo("Thanks for your feedback.");
    } catch (err) {
      setFeedbackDialog({ messageId, saving: false, error: getErrorMessage(err) });
    }
  }

  function handleRegenerate(index: number) {
    runTurn({ regenerateMessageId: messages[index].id }, index);
  }

  async function navigate(
    mutate: typeof switchBranch,
    field: "switchBranch" | "rewindConversation",
    messageId: string
  ) {
    if (!conversationId || busy) return;
    setNavigating(true);
    setActionError(null);
    try {
      const { data } = await mutate({ variables: { conversationId, messageId } });
      if (data?.[field] && loadedConversationIdRef.current === conversationId) {
        showConversation(data[field]);
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setNavigating(false);
    }
  }

  function handleSwitchVersion(message: ChatMessage, direction: -1 | 1) {
    const siblings = message.siblingIds ?? [];
    const target = siblings[siblings.indexOf(message.id) + direction];
    if (target) navigate(switchBranch, "switchBranch", target);
  }

  function handleRewind(message: ChatMessage) {
    navigate(rewindConversation, "rewindConversation", message.id);
  }

  function handleJumpToLatest() {
    const last = messages[messages.length - 1];
    if (last) navigate(switchBranch, "switchBranch", last.id);
  }

  async function handleConversationDeleted(id: string) {
    if (id === conversationId) {
      router.replace("/chat");
    }
    await refetchMe();
  }

  const conversations: ConversationSummary[] = meData?.me?.conversations ?? [];

  const showLoadingHistory = Boolean(conversationId) && convoLoading && messages.length === 0;
  const historyError =
    conversationId && convoError && messages.length === 0 ? getErrorMessage(convoError) : null;
  const awaitingClarification = messages[messages.length - 1]?.clarification === "pending";

  return (
    <main className="dashboard-shell chat-page">
      <Header active="chat" showChatActions />

      <div className="chat-layout">
        <Sidebar
          conversations={conversations}
          loading={meLoading}
          activeId={conversationId}
          onDeleted={handleConversationDeleted}
        />

        <div
          className="chat-shell"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            if (!busy) setDraggingFiles(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDraggingFiles(false);
          }}
          onDrop={handleDrop}
        >
          <div className="chat-messages">
            <div className="chat-messages-column">
              {showLoadingHistory && <p className="empty-state chat-empty">Loading conversation…</p>}

              {historyError && (
                <div className="error-banner" role="alert">
                  {historyError}{" "}
                  <Link href="/chat">Start a new chat</Link>
                </div>
              )}

              {!showLoadingHistory && !historyError && shownMessages.length === 0 && (
                <p className="empty-state chat-empty">
                  Ask a question — the agent checks your knowledge base first, answers from its own
                  knowledge if it can, and only searches the web when the question needs current
                  info or nothing else has the answer.
                </p>
              )}

              {shownMessages.map((m, index) => {
                const siblings = m.siblingIds ?? [m.id];
                const versionIndex = siblings.indexOf(m.id);
                const isEditing = editing?.id === m.id;
                const canAct = !m.local && !m.error && !busy;
                const isLast = index === shownMessages.length - 1;
                const previous = shownMessages[index - 1];

                return (
                  <div key={m.id} className={`chat-bubble chat-bubble-${m.role}`}>
                    {m.clarification && (
                      <span className={`chat-hitl-label chat-hitl-${m.clarification}`}>
                        {m.clarification === "pending" ? "Needs your input" : "Clarifying question"}
                      </span>
                    )}
                    {isEditing ? (
                      <form
                        className="chat-edit"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleEditSave(index);
                        }}
                      >
                        <textarea
                          autoFocus
                          rows={3}
                          maxLength={4000}
                          value={editing.text}
                          onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleEditSave(index);
                            } else if (e.key === "Escape") {
                              setEditing(null);
                            }
                          }}
                        />
                        <div className="chat-edit-actions">
                          <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-primary chat-send"
                            disabled={busy || (!editing.text.trim() && !m.attachments?.length)}
                          >
                            Save &amp; submit
                          </button>
                        </div>
                      </form>
                    ) : m.streaming && !m.content ? (
                      <div className="chat-bubble-content chat-thinking">
                        {m.status ? STATUS_LABELS[m.status] : "Thinking…"}
                      </div>
                    ) : m.role === "assistant" && !m.error ? (
                      <div
                        className={`chat-bubble-content chat-bubble-markdown ${
                          m.clarification === "pending" ? "chat-bubble-hitl" : ""
                        } ${m.streaming ? "chat-bubble-streaming" : ""}`}
                      >
                        <MarkdownMessage content={m.content} />
                      </div>
                    ) : (
                      <>
                        {m.attachments && m.attachments.length > 0 && <MessageAttachments items={m.attachments} />}
                        {(m.content || m.error || !m.attachments?.length) && (
                          <div className={`chat-bubble-content ${m.error ? "chat-bubble-error" : ""}`}>
                            {m.content}
                          </div>
                        )}
                      </>
                    )}
                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                      <div className="chat-tools">
                        {m.toolsUsed.map((tool) => (
                          <span key={tool} className="chat-tool-badge">
                            {TOOL_LABELS[tool] || tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {!isEditing && !m.local && !m.error && (
                      <div className="chat-msg-footer">
                      {m.role === "assistant" && (
                        <div
                          className={`chat-feedback ${m.feedback ? "rated" : ""} ${isLast ? "latest" : ""}`}
                          role="group"
                          aria-label="Response actions"
                        >
                          <CopyButton text={m.content} />
                          {(["LIKE", "DISLIKE"] as const).map((rating) => {
                            const active = m.feedback?.rating === rating;
                            const label =
                              rating === "LIKE"
                                ? active ? "Remove like" : "Good response"
                                : active ? "Remove dislike" : "Bad response";
                            return (
                              <button
                                key={rating}
                                type="button"
                                className={`chat-feedback-btn ${active ? "active" : ""}`}
                                aria-pressed={active}
                                title={label}
                                aria-label={label}
                                onClick={() => handleFeedback(m, rating)}
                              >
                                <svg
                                  width="15"
                                  height="15"
                                  viewBox="0 0 24 24"
                                  fill={active ? "currentColor" : "none"}
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden="true"
                                  style={rating === "DISLIKE" ? { transform: "scaleY(-1)" } : undefined}
                                >
                                  <path d="M7 10v12" />
                                  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                                </svg>
                              </button>
                            );
                          })}
                          {m.feedback?.rating === "DISLIKE" && (
                            <button
                              type="button"
                              className="chat-action chat-feedback-reason"
                              onClick={() => setFeedbackDialog({ messageId: m.id, saving: false, error: null })}
                            >
                              {m.feedback.reason || m.feedback.categories.length > 0 ? "Edit feedback" : "Add a reason"}
                            </button>
                          )}
                        </div>
                      )}
                      <div className={`chat-msg-actions ${siblings.length > 1 ? "has-versions" : ""}`}>
                        {siblings.length > 1 && (
                          <span className="chat-versions" aria-label="Message versions">
                            <button
                              type="button"
                              className="chat-action"
                              title="Previous version"
                              disabled={busy || versionIndex <= 0}
                              onClick={() => handleSwitchVersion(m, -1)}
                            >
                              ‹
                            </button>
                            <span>
                              {versionIndex + 1}/{siblings.length}
                            </span>
                            <button
                              type="button"
                              className="chat-action"
                              title="Next version"
                              disabled={busy || versionIndex >= siblings.length - 1}
                              onClick={() => handleSwitchVersion(m, 1)}
                            >
                              ›
                            </button>
                          </span>
                        )}
                        {m.role === "user" && m.content && <CopyButton text={m.content} className="chat-copy-user" />}
                        {m.role === "user" && (
                          <button
                            type="button"
                            className="chat-action"
                            title="Edit this message — starts a new branch"
                            disabled={!canAct}
                            onClick={() => setEditing({ id: m.id, text: m.content })}
                          >
                            Edit
                          </button>
                        )}
                        {m.role === "assistant" && previous?.role === "user" && (
                          <button
                            type="button"
                            className="chat-action"
                            title="Generate a new version of this reply"
                            disabled={!canAct}
                            onClick={() => handleRegenerate(index)}
                          >
                            Regenerate
                          </button>
                        )}
                        {m.role === "assistant" && !isLast && (
                          <button
                            type="button"
                            className="chat-action"
                            title="Go back to this point — later messages are kept on their branch"
                            disabled={!canAct}
                            onClick={() => handleRewind(m)}
                          >
                            Rewind here
                          </button>
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>
          </div>

          {actionError && <div className="error-banner chat-action-error">{actionError}</div>}

          {isRewound && !busy && (
            <div className="chat-rewound-banner">
              <span>
                You&apos;re viewing an earlier point in this conversation. Sending a message starts
                a new branch from here.
              </span>
              <button type="button" className="btn-ghost" onClick={handleJumpToLatest}>
                Jump to latest
              </button>
            </div>
          )}

          <div className="chat-composer">
            {pendingFiles.notice && <div className="composer-notice">{pendingFiles.notice}</div>}
            {speech.error && (
              <div className="composer-notice composer-notice-error" role="alert">
                {speech.error}{" "}
                <button type="button" className="composer-notice-dismiss" onClick={speech.clearError}>
                  Dismiss
                </button>
              </div>
            )}
            {speech.listening && (
              <div className="composer-notice composer-listening" role="status">
                <span className="listening-dot" aria-hidden="true" /> Listening… click the mic or press Send when you&apos;re done.
              </div>
            )}
            {pendingFiles.items
              .filter((img) => img.status === "error")
              .map((img) => (
                <div key={img.localId} className="composer-notice composer-notice-error">
                  {img.error}
                </div>
              ))}
            <PendingAttachments items={pendingFiles.items} onRemove={pendingFiles.remove} />

            <form className="chat-input-row" onSubmit={handleSubmit}>
              <AttachMenu disabled={busy} canAddMore={pendingFiles.canAddMore} onFiles={pendingFiles.addFiles} />
              <button
                type="button"
                className={`chat-attach chat-mic ${speech.listening ? "listening" : ""}`}
                onClick={toggleDictation}
                disabled={!speech.supported || (busy && !speech.listening)}
                aria-pressed={speech.listening}
                title={
                  !speech.supported
                    ? "Voice input isn't supported in this browser (try Chrome, Edge or Safari)"
                    : speech.listening
                      ? "Stop voice input"
                      : "Voice input"
                }
                aria-label={speech.listening ? "Stop voice input" : "Voice input"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
                </svg>
              </button>
              <input
                type="text"
                placeholder={
                  awaitingClarification
                    ? "Answer the question above…"
                    : pendingFiles.items.length > 0
                      ? pendingFiles.hasDocuments
                        ? "Ask about the file…"
                        : "Ask about the image…"
                      : "Ask a question…"
                }
                value={input}
                maxLength={4000}
                onChange={(e) => {
                  if (speech.listening) speech.cancel();
                  setInput(e.target.value);
                }}
                onPaste={handlePaste}
                disabled={busy}
              />
              <button
                className="btn-primary chat-send"
                type="submit"
                disabled={busy || pendingFiles.uploading || (!input.trim() && pendingFiles.readyCount === 0)}
                title={pendingFiles.uploading ? "Waiting for files to finish reading…" : undefined}
              >
                Send
              </button>
            </form>
          </div>

          {feedbackDialog && (() => {
            const target = messages.find((m) => m.id === feedbackDialog.messageId);
            return (
              <FeedbackDialog
                key={feedbackDialog.messageId}
                initialCategories={target?.feedback?.categories}
                initialReason={target?.feedback?.reason}
                saving={feedbackDialog.saving}
                error={feedbackDialog.error}
                onSubmit={submitDislikeReason}
                onSkip={() => setFeedbackDialog(null)}
              />
            );
          })()}

          {draggingFiles && (
            <div className="chat-drop-overlay" aria-hidden="true">
              Drop images or documents to attach
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
