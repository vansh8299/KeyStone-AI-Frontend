"use client";

import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  split,
  ApolloLink,
  Observable,
  FetchResult,
  Operation,
} from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import { createUploadLink } from "./uploadLink";
import { GRAPHQL_URL, redirectToLogin, refreshSession } from "./session";
import { ReactNode } from "react";

const GRAPHQL_WS_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || GRAPHQL_URL.replace(/^http/, "ws");

const httpLink = createUploadLink({
  uri: GRAPHQL_URL,
  credentials: "include",
});

const SESSION_OPERATIONS = new Set(["Login", "Signup", "RefreshToken", "Logout"]);

function needsRefresh(operation: Operation, result: FetchResult): boolean {
  if (SESSION_OPERATIONS.has(operation.operationName)) return false;
  if (result.errors?.some((e) => e.extensions?.code === "UNAUTHENTICATED")) return true;
  return operation.operationName === "Me" && result.data?.me === null;
}

const sessionLink = new ApolloLink(
  (operation, forward) =>
    new Observable<FetchResult>((observer) => {
      let subscription: { unsubscribe(): void } | undefined;
      let refreshing = false;
      let closed = false;

      const attempt = (isRetry: boolean) => {
        subscription = forward(operation).subscribe({
          next: (result) => {
            if (isRetry || !needsRefresh(operation, result)) {
              observer.next(result);
              return;
            }
            refreshing = true;
            refreshSession().then((renewed) => {
              if (closed) return;
              refreshing = false;
              if (renewed) {
                subscription?.unsubscribe();
                attempt(true);
                return;
              }
              if (operation.operationName !== "Me") redirectToLogin("expired");
              observer.next(result);
              observer.complete();
            });
          },
          error: (err) => observer.error(err),
          complete: () => {
            if (!refreshing) observer.complete();
          },
        });
      };
      attempt(false);

      return () => {
        closed = true;
        subscription?.unsubscribe();
      };
    })
);

function createTransportLink(): ApolloLink {
  if (typeof window === "undefined") return httpLink;

  const wsLink = new GraphQLWsLink(
    createClient({
      url: GRAPHQL_WS_URL,
      lazy: true,
      lazyCloseTimeout: 0,
      retryAttempts: 0,
      shouldRetry: () => false,
    })
  );

  return split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === "OperationDefinition" && definition.operation === "subscription";
    },
    wsLink,
    httpLink
  );
}

const client = new ApolloClient({
  link: ApolloLink.from([sessionLink, createTransportLink()]),
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export default client;
