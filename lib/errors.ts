import { ApolloError } from "@apollo/client";
import type { GraphQLFormattedError } from "graphql";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_USER_INPUT"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
  field?: string;
  errorId?: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session has expired. Please log in again.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "That item doesn't exist or was deleted.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  PAYLOAD_TOO_LARGE: "That's too large to upload.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again in a moment.",
  INTERNAL_SERVER_ERROR: "Something went wrong on our side. Please try again.",
  NETWORK_ERROR: "Can't reach the server. Check your internet connection and try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

function fromGraphQLError(error: GraphQLFormattedError): ApiError {
  const ext = (error.extensions ?? {}) as Record<string, unknown>;
  const code = typeof ext.code === "string" ? ext.code : "UNKNOWN";
  return {
    code,
    message: error.message || FALLBACK_MESSAGES[code] || FALLBACK_MESSAGES.UNKNOWN,
    field: typeof ext.field === "string" ? ext.field : undefined,
    errorId: typeof ext.errorId === "string" ? ext.errorId : undefined,
  };
}

function isGraphQLErrorList(value: unknown): value is GraphQLFormattedError[] {
  return Array.isArray(value) && value.length > 0 && typeof value[0]?.message === "string";
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApolloError) {
    if (error.graphQLErrors.length > 0) return fromGraphQLError(error.graphQLErrors[0]);
    const network = error.networkError as (Error & { result?: { errors?: unknown }; statusCode?: number }) | null;
    const body = network?.result && typeof network.result === "object" ? network.result.errors : undefined;
    if (isGraphQLErrorList(body)) return fromGraphQLError(body[0]);
    if (network) return { code: "NETWORK_ERROR", message: FALLBACK_MESSAGES.NETWORK_ERROR };
  }
  if (isGraphQLErrorList(error)) return fromGraphQLError(error[0]);
  if (typeof CloseEvent !== "undefined" && error instanceof CloseEvent) {
    return { code: "NETWORK_ERROR", message: "The connection to the server was lost. Please try again." };
  }
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return { code: "NETWORK_ERROR", message: FALLBACK_MESSAGES.NETWORK_ERROR };
  }
  if (error instanceof Error && error.message) return { code: "UNKNOWN", message: error.message };
  return { code: "UNKNOWN", message: FALLBACK_MESSAGES.UNKNOWN };
}

export function getErrorMessage(error: unknown): string {
  const { message, errorId } = toApiError(error);
  return errorId ? `${message} (Ref: ${errorId.slice(0, 8)})` : message;
}

export function getErrorCode(error: unknown): string {
  return toApiError(error).code;
}
