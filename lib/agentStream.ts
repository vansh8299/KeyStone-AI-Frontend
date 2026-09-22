import { ApolloError, type DocumentNode } from "@apollo/client";
import client from "./apolloClient";
import { ASK_AGENT_STREAM, CONVERSATION_TURN } from "./graphql/rag";

export interface AgentDone {
  answer: string;
  toolsUsed: string[];
  conversationId: string;
  needsHumanInput: boolean;
  userMessageId: string;
  assistantMessageId: string;
}

export interface AgentStreamRequest {
  question?: string;
  conversationId?: string | null;
  editMessageId?: string;
  regenerateMessageId?: string;
  attachmentIds?: string[];
}

export interface AgentStreamHandlers {
  onConversation?: (conversationId: string) => void;
  onToken?: (text: string) => void;
  onStatus?: (status: AgentStatus) => void;
}

export type AgentStatus = "CHECKING_ANSWER" | "IMPROVING_ANSWER";

type AgentStreamEvent =
  | { type: "CONVERSATION"; conversationId: string }
  | { type: "TOKEN"; text: string }
  | { type: "STATUS"; status: AgentStatus }
  | { type: "DONE"; result: AgentDone };

function runStream(
  query: DocumentNode,
  field: "askAgentStream" | "conversationTurn",
  variables: Record<string, unknown>,
  { onConversation, onToken, onStatus }: AgentStreamHandlers
): Promise<AgentDone | null> {
  return new Promise((resolve, reject) => {
    let done: AgentDone | null = null;
    let settled = false;

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const subscription = client
      .subscribe<Record<string, AgentStreamEvent>>({
        query,
        variables,
        fetchPolicy: "no-cache",
      })
      .subscribe({
        next: ({ data, errors }) => {
          if (errors?.length) {
            fail(errors);
            subscription.unsubscribe();
            return;
          }
          const event = data?.[field];
          if (!event) return;
          switch (event.type) {
            case "CONVERSATION":
              onConversation?.(event.conversationId);
              break;
            case "TOKEN":
              onToken?.(event.text);
              break;
            case "STATUS":
              onStatus?.(event.status);
              break;
            case "DONE":
              done = event.result;
              break;
          }
        },
        error: fail,
        complete: () => {
          if (settled) return;
          settled = true;
          resolve(done);
        },
      });
  });
}

export async function streamAgent(
  { question, conversationId, editMessageId, regenerateMessageId, attachmentIds }: AgentStreamRequest,
  handlers: AgentStreamHandlers = {}
): Promise<AgentDone> {
  const done = await runStream(
    ASK_AGENT_STREAM,
    "askAgentStream",
    {
      question: question ?? null,
      conversationId: conversationId ?? null,
      editMessageId: editMessageId ?? null,
      regenerateMessageId: regenerateMessageId ?? null,
      attachmentIds: attachmentIds ?? null,
    },
    handlers
  );
  if (!done) throw new Error("The reply stopped unexpectedly. Please try again.");
  return done;
}

export function resumeAgent(conversationId: string, handlers: AgentStreamHandlers = {}): Promise<AgentDone | null> {
  return runStream(CONVERSATION_TURN, "conversationTurn", { conversationId }, handlers);
}

export function isConnectionError(err: unknown): boolean {
  if (Array.isArray(err)) return false;
  if (err instanceof ApolloError) return err.graphQLErrors.length === 0 && Boolean(err.networkError);
  if (typeof CloseEvent !== "undefined" && err instanceof CloseEvent) return true;
  return err instanceof Error && /socket|connection|network|fetch/i.test(err.message);
}
