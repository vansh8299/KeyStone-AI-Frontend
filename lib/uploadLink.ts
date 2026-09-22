import { ApolloLink, Observable, FetchResult } from "@apollo/client";
import { print } from "graphql";

interface UploadLinkOptions {
  uri: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
}

function isFile(value: unknown): value is File | Blob {
  return typeof File !== "undefined" && value instanceof File
    ? true
    : typeof Blob !== "undefined" && value instanceof Blob;
}

function extractFiles(variables: Record<string, unknown>): {
  clean: Record<string, unknown>;
  files: Map<string, File | Blob>;
} {
  const files = new Map<string, File | Blob>();

  function walk(value: unknown, path: string): unknown {
    if (isFile(value)) {
      files.set(path, value);
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => walk(item, `${path}.${i}`));
    }
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = walk(val, `${path}.${key}`);
      }
      return result;
    }
    return value;
  }

  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(variables)) {
    clean[key] = walk(val, `variables.${key}`);
  }

  return { clean, files };
}

export function createUploadLink(options: UploadLinkOptions): ApolloLink {
  return new ApolloLink((operation) => {
    return new Observable<FetchResult>((observer) => {
      const { query, variables, operationName } = operation;
      const { clean, files } = extractFiles(variables || {});

      const body = {
        query: print(query),
        variables: clean,
        operationName,
      };

      let fetchPromise: Promise<Response>;

      if (files.size === 0) {
        fetchPromise = fetch(options.uri, {
          method: "POST",
          credentials: options.credentials,
          headers: { "Content-Type": "application/json", ...options.headers },
          body: JSON.stringify(body),
        });
      } else {
        const map: Record<string, string[]> = {};
        const paths = Array.from(files.keys());
        paths.forEach((path, i) => {
          map[i] = [path];
        });

        const form = new FormData();
        form.append("operations", JSON.stringify(body));
        form.append("map", JSON.stringify(map));
        paths.forEach((path, i) => {
          form.append(String(i), files.get(path) as Blob);
        });

        fetchPromise = fetch(options.uri, {
          method: "POST",
          credentials: options.credentials,
          headers: { "apollo-require-preflight": "true", ...options.headers },
          body: form,
        });
      }

      fetchPromise
        .then((res) => res.json())
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((err) => observer.error(err));
    });
  });
}
