"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@apollo/client";
import { UPLOAD_CHAT_FILE } from "@/lib/graphql/rag";
import { getErrorMessage } from "@/lib/errors";
import { Spinner } from "@/components/Loader";
import { FileRejectedError, MAX_FILES_PER_MESSAGE, fileKind, prepareFile, type FileKind } from "@/lib/fileUpload";

export interface PendingAttachment {
  localId: string;
  kind: FileKind;
  filename: string;
  previewUrl?: string;
  status: "uploading" | "ready" | "error";
  id?: string;
  parsedText?: string;
  summary?: string;
  pageCount?: number | null;
  error?: string;
}

export interface MessageAttachmentView {
  id?: string;
  kind: FileKind;
  filename: string;
  src: string;
  parsedText?: string;
  summary?: string;
  pageCount?: number | null;
}

interface UploadResult {
  id: string;
  kind: FileKind;
  parsedText: string | null;
  summary: string | null;
  pageCount: number | null;
}

export function usePendingAttachments() {
  const [items, setItems] = useState<PendingAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadChatFile] = useMutation<{ uploadChatFile: UploadResult }>(UPLOAD_CHAT_FILE);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const live = urls.current;
    return () => live.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const update = (localId: string, patch: Partial<PendingAttachment>) =>
    setItems((prev) => prev.map((a) => (a.localId === localId ? { ...a, ...patch } : a)));

  // Latest items for callbacks created once (addFiles); synced after each render, never during it.
  const current = useRef<PendingAttachment[]>([]);
  useLayoutEffect(() => {
    current.current = items;
  }, [items]);

  const addFiles = useCallback(
    (files: File[]) => {
      setNotice(null);
      const room = MAX_FILES_PER_MESSAGE - current.current.length;
      if (files.length > room) setNotice(`You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.`);
      const accepted = files.slice(0, Math.max(0, room));

      const added: PendingAttachment[] = accepted.map((file) => {
        const kind = fileKind(file) ?? "document";
        let previewUrl: string | undefined;
        if (kind === "image") {
          previewUrl = URL.createObjectURL(file);
          urls.current.add(previewUrl);
        }
        return {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind,
          filename: file.name,
          previewUrl,
          status: "uploading",
        };
      });
      current.current = [...current.current, ...added];
      setItems((prev) => [...prev, ...added]);

      added.forEach((item, i) => {
        prepareFile(accepted[i])
          .then((prepared) => uploadChatFile({ variables: { file: prepared } }))
          .then(({ data }) => {
            const result = data!.uploadChatFile;
            update(item.localId, {
              status: "ready",
              id: result.id,
              kind: result.kind,
              parsedText: result.parsedText ?? undefined,
              summary: result.summary ?? undefined,
              pageCount: result.pageCount,
            });
          })
          .catch((err) =>
            update(item.localId, {
              status: "error",
              error: err instanceof FileRejectedError ? err.message : getErrorMessage(err),
            })
          );
      });
    },
    [uploadChatFile]
  );

  const remove = useCallback((localId: string) => {
    setItems((prev) => {
      const item = prev.find((a) => a.localId === localId);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        urls.current.delete(item.previewUrl);
      }
      return prev.filter((a) => a.localId !== localId);
    });
  }, []);

  const takeReady = useCallback((): { ids: string[]; shown: MessageAttachmentView[] } => {
    const ready = items.filter((a) => a.status === "ready" && a.id);
    ready.forEach((a) => a.previewUrl && urls.current.delete(a.previewUrl));
    setItems((prev) => prev.filter((a) => a.status !== "ready"));
    setNotice(null);
    return {
      ids: ready.map((a) => a.id!),
      shown: ready.map((a) => ({
        id: a.id,
        kind: a.kind,
        filename: a.filename,
        src: a.previewUrl ?? "",
        parsedText: a.parsedText,
        summary: a.summary,
        pageCount: a.pageCount,
      })),
    };
  }, [items]);

  return {
    items,
    notice,
    addFiles,
    remove,
    takeReady,
    uploading: items.some((a) => a.status === "uploading"),
    readyCount: items.filter((a) => a.status === "ready").length,
    canAddMore: items.length < MAX_FILES_PER_MESSAGE,
    hasDocuments: items.some((a) => a.kind === "document"),
  };
}

function docLabel(filename: string): string {
  const ext = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  return ext === "MARKDOWN" ? "MD" : ext ?? "FILE";
}

function pagesLabel(filename: string, pageCount?: number | null): string | null {
  if (!pageCount) return null;
  const unit = /\.(xlsx|xls|csv)$/i.test(filename) ? "sheet" : "page";
  return `${pageCount} ${unit}${pageCount === 1 ? "" : "s"}`;
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

export function PendingAttachments({
  items,
  onRemove,
}: {
  items: PendingAttachment[];
  onRemove: (localId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="pending-images" aria-label="Attached files">
      {items.map((a) =>
        a.kind === "image" ? (
          <li key={a.localId} className={`pending-image pending-image-${a.status}`} title={a.error ?? a.filename}>
            <img src={a.previewUrl} alt={a.filename} />
            {a.status === "uploading" && (
              <span className="pending-image-overlay" role="status" aria-label="Reading image">
                <Spinner size={18} />
              </span>
            )}
            {a.status === "error" && <span className="pending-image-overlay pending-image-error">Failed</span>}
            <RemoveButton filename={a.filename} onClick={() => onRemove(a.localId)} />
          </li>
        ) : (
          <li key={a.localId} className={`pending-doc pending-doc-${a.status}`} title={a.error ?? a.filename}>
            <span className="doc-icon">
              <DocIcon />
            </span>
            <span className="doc-text">
              <span className="doc-name">{a.filename}</span>
              <span className="doc-meta">
                {a.status === "uploading" ? (
                  <>
                    <Spinner size={10} /> Reading…
                  </>
                ) : a.status === "error"
                  ? "Failed"
                  : [docLabel(a.filename), pagesLabel(a.filename, a.pageCount)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <RemoveButton filename={a.filename} onClick={() => onRemove(a.localId)} />
          </li>
        )
      )}
    </ul>
  );
}

function RemoveButton({ filename, onClick }: { filename: string; onClick: () => void }) {
  return (
    <button type="button" className="pending-image-remove" onClick={onClick} aria-label={`Remove ${filename}`}>
      ×
    </button>
  );
}

export function MessageAttachments({ items }: { items: MessageAttachmentView[] }) {
  if (items.length === 0) return null;
  const images = items.filter((a) => a.kind === "image");
  const documents = items.filter((a) => a.kind === "document");
  const readable = items.filter((a) => (a.kind === "image" ? a.parsedText : a.summary));

  return (
    <div className="message-images">
      {images.length > 0 && (
        <div className="message-image-grid">
          {images.map((img, i) => (
            <a key={img.id ?? i} href={img.src} target="_blank" rel="noopener noreferrer" title={img.filename}>
              <img src={img.src} alt={img.filename} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {documents.length > 0 && (
        <div className="message-docs">
          {documents.map((d, i) => {
            const meta = [docLabel(d.filename), pagesLabel(d.filename, d.pageCount)].filter(Boolean).join(" · ");
            const inner = (
              <>
                <span className="doc-icon">
                  <DocIcon />
                </span>
                <span className="doc-text">
                  <span className="doc-name">{d.filename}</span>
                  <span className="doc-meta">{meta}</span>
                </span>
              </>
            );
            return d.id && d.src ? (
              <a key={d.id} className="message-doc" href={d.src} download={d.filename} title={`Download ${d.filename}`}>
                {inner}
              </a>
            ) : (
              <div key={d.id ?? i} className="message-doc">
                {inner}
              </div>
            );
          })}
        </div>
      )}
      {readable.length > 0 && (
        <details className="message-image-text">
          <summary>What the assistant read from {items.length === 1 ? "this file" : "these files"}</summary>
          {readable.map((a, i) => (
            <div key={a.id ?? i}>
              {readable.length > 1 && <strong>{a.filename}</strong>}
              <pre>{a.kind === "image" ? a.parsedText : a.summary}</pre>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
