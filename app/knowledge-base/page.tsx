"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  INGEST_FILE,
  INGEST_TEXT,
  DELETE_INGESTED_DOCUMENT,
  DOCUMENTS,
} from "@/lib/graphql/rag";
import Header from "@/components/Header";
import ServerUnavailable from "@/components/ServerUnavailable";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useToast } from "@/components/Toaster";
import { useConfirm } from "@/components/ConfirmDialog";
import { ButtonLabel, SkeletonList, Spinner } from "@/components/Loader";
import { getErrorMessage, toApiError } from "@/lib/errors";
import { sha256Hex } from "@/lib/fileUpload";
import FormField from "@/components/FormField";
import FileTypeIcon, { fileTypeInfo } from "@/components/FileTypeIcon";
import { LIMITS, rules, useForm } from "@/lib/validation";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".md",
  ".markdown",
  ".rtf",
  ".xlsx",
  ".xls",
  ".csv",
];

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function checkFile(file: File): string | null {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type${ext ? ` (${ext})` : ""}. Use one of: ${ACCEPTED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 25 MB.`;
  }
  if (file.size === 0) return "This file is empty.";
  return null;
}

const pasteValidators = {
  title: rules.requiredText("Title", LIMITS.ingestTitleMaxChars, true),
  content: rules.requiredText("Content", LIMITS.ingestTextMaxChars),
};

interface UploadItem {
  id: string;
  file: File;
  filename: string;
  /** pending: chosen but not sent yet · queued: waiting its turn in an ingest run. */
  status: "pending" | "queued" | "uploading" | "done" | "error";
  chunkCount?: number;
  pipeline?: string;
  error?: string;
  /** False when retrying can't help (unsupported type, too large, duplicate, rejected as invalid). */
  retryable?: boolean;
  /** SHA-256 of the file, filled in shortly after it's chosen; null if the browser can't hash. */
  hash?: string | null;
}

interface KbDocument {
  id: string;
  title: string;
  contentHash: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "Today, 10:04", "Yesterday, 18:30", or "12 Sep 2026" — friendlier than a full timestamp. */
function formatAdded(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  if (date >= startOfToday) return `Added today, ${time}`;
  if (date.getTime() >= startOfToday.getTime() - dayMs) return `Added yesterday, ${time}`;
  return `Added ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

// Server rejections that will fail the same way on retry.
const NON_RETRYABLE_CODES = new Set(["BAD_USER_INPUT", "PAYLOAD_TOO_LARGE", "CONFLICT"]);

export default function KnowledgeBasePage() {
  const auth = useCurrentUser();

  const { data: docsData, loading: docsLoading, error: docsError, refetch } = useQuery(DOCUMENTS, {
    fetchPolicy: "network-only",
    skip: auth.status !== "authenticated",
  });

  const [ingestFile] = useMutation(INGEST_FILE);
  const [ingestText] = useMutation(INGEST_TEXT);
  const [deleteDoc] = useMutation(DELETE_INGESTED_DOCUMENT);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const paste = useForm({ title: "", content: "" }, pasteValidators);
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showSuccess } = useToast();
  const confirm = useConfirm();


  function updateUpload(id: string, patch: Partial<UploadItem>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  async function uploadOne(id: string, file: File) {
    updateUpload(id, { status: "uploading", error: undefined });
    try {
      const { data } = await ingestFile({ variables: { file } });
      updateUpload(id, {
        status: "done",
        chunkCount: data.ingestFile.chunkCount,
        pipeline: data.ingestFile.pipeline,
      });
      refetch();
    } catch (err) {
      updateUpload(id, {
        status: "error",
        error: getErrorMessage(err),
        retryable: !NON_RETRYABLE_CODES.has(toApiError(err).code),
      });
    }
  }

  /** Adds chosen files to the list without uploading; invalid ones are flagged straight away. */
  function handleFiles(files: FileList | File[]) {
    const staged = new Set(uploads.filter((u) => u.status === "pending").map((u) => fileKey(u.file)));
    const added: UploadItem[] = [];
    for (const file of Array.from(files)) {
      if (staged.has(fileKey(file))) continue; // same file picked twice
      staged.add(fileKey(file));
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const problem = checkFile(file);
      added.push(
        problem
          ? { id, file, filename: file.name, status: "error", error: problem, retryable: false }
          : { id, file, filename: file.name, status: "pending" }
      );
    }
    if (added.length === 0) return;
    setUploads((prev) => [...prev, ...added]);
    // Hash in the background so duplicates show up before anything is uploaded.
    for (const item of added) {
      if (item.status !== "pending") continue;
      sha256Hex(item.file).then((hash) => updateUpload(item.id, { hash }));
    }
  }

  const documents: KbDocument[] = useMemo(() => docsData?.documents ?? [], [docsData]);
  const knownHashes = useMemo(
    () => new Map(documents.filter((d) => d.contentHash).map((d) => [d.contentHash as string, d.title])),
    [documents]
  );

  /** Why a chosen file would be a duplicate, or null. Recomputed live, so deleting the original re-enables it. */
  function duplicateReason(item: UploadItem): string | null {
    if (item.status !== "pending" || !item.hash) return null;
    const existing = knownHashes.get(item.hash);
    if (existing) return `Already in your knowledge base as "${existing}".`;
    const index = uploads.indexOf(item);
    const earlier = uploads.find((u, i) => i < index && u.hash === item.hash && u.status !== "error");
    if (earlier) return `Same content as "${earlier.filename}" above.`;
    return null;
  }

  async function ingestPending() {
    const batch = uploads.filter((u) => u.status === "pending" && !duplicateReason(u));
    if (batch.length === 0 || ingesting) return;
    setIngesting(true);
    const ids = new Set(batch.map((u) => u.id));
    setUploads((prev) => prev.map((u) => (ids.has(u.id) ? { ...u, status: "queued" } : u)));
    for (const item of batch) await uploadOne(item.id, item.file);
    setIngesting(false);
  }

  function clearPending() {
    setUploads((prev) => prev.filter((u) => u.status !== "pending" && !(u.status === "error" && !u.retryable)));
  }

  function retryUpload(item: UploadItem) {
    if (item.status !== "error" || !item.retryable) return;
    uploadOne(item.id, item.file);
  }

  function dismissUpload(id: string) {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  const pendingCount = uploads.filter((u) => u.status === "pending" && !duplicateReason(u)).length;
  const duplicateCount = uploads.filter((u) => duplicateReason(u)).length;
  const hasClearable = uploads.some((u) => u.status === "pending" || (u.status === "error" && !u.retryable));

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasteError(null);
    if (!paste.validateAll()) return;
    const title = paste.values.title.trim();
    setPasteSubmitting(true);
    try {
      await ingestText({ variables: { input: { title, content: paste.values.content.trim() } } });
      showSuccess(`"${title}" was added to the knowledge base.`);
      paste.reset();
      refetch();
    } catch (err) {
      const apiError = toApiError(err);
      if (!paste.applyServerError(apiError.field, apiError.message)) setPasteError(getErrorMessage(err));
    } finally {
      setPasteSubmitting(false);
    }
  }

  async function handleDelete(doc: { id: string; title: string }) {
    const deleted = await confirm({
      title: "Delete document?",
      message: (
        <>
          <strong>{doc.title}</strong> will be removed from your knowledge base, and the assistant will no
          longer use it to answer questions. This can&apos;t be undone.
        </>
      ),
      confirmLabel: "Delete document",
      busyLabel: "Deleting…",
      tone: "danger",
      onConfirm: () => deleteDoc({ variables: { documentId: doc.id } }),
    });
    if (!deleted) return;
    showSuccess("Document deleted");
    refetch();
  }

  if (auth.status === "error") return <ServerUnavailable onRetry={auth.retry} />;

  return (
    <main className="dashboard-shell scroll-page">
      <Header active="knowledge-base" />

      <div className="page-scroll">
        <div className="dashboard-body kb-body">
          <h1 className="auth-title">Knowledge base</h1>
          <p className="auth-subtitle">
            Upload PDFs, Word docs, text, markdown, or spreadsheets — each is chunked and embedded
            automatically for retrieval.
          </p>

          <div
            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="dropzone-title">Drag & drop files here, or click to choose</p>
            <p className="dropzone-hint">{ACCEPTED_EXTENSIONS.join("  ·  ")}</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              hidden
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {uploads.length > 0 && (
            <ul className="upload-list">
              {uploads.map((u) => {
                const duplicate = duplicateReason(u);
                return (
                <li key={u.id} className={`upload-item upload-${u.status} ${duplicate ? "upload-duplicate" : ""}`}>
                  <FileTypeIcon filename={u.filename} />
                  <div className="upload-main">
                    <span className="upload-filename">{u.filename}</span>
                    {u.status === "pending" &&
                      (duplicate ? (
                        <span className="upload-status upload-duplicate-text" role="status">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="8" y="8" width="13" height="13" rx="2" />
                            <path d="M4 16V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          Duplicate — {duplicate} It won&apos;t be ingested.
                        </span>
                      ) : (
                        <span className="upload-status">
                          {formatBytes(u.file.size)} · {u.hash === undefined ? "Checking for duplicates…" : "Ready to ingest"}
                        </span>
                      ))}
                    {u.status === "queued" && <span className="upload-status">Waiting…</span>}
                    {u.status === "uploading" && (
                      <span className="upload-status">
                        <Spinner size={12} /> Ingesting…
                      </span>
                    )}
                    {u.status === "done" && (
                      <span className="upload-status upload-done-text">
                        ✓ {u.chunkCount} chunks · {u.pipeline} pipeline
                      </span>
                    )}
                    {u.status === "error" && (
                      <span className="upload-status upload-error-text" role="alert">
                        {u.error}
                      </span>
                    )}
                  </div>
                  {(u.status === "pending" || u.status === "error" || u.status === "done") && (
                    <div className="upload-actions">
                      {u.status === "error" && u.retryable && (
                        <button
                          type="button"
                          className="upload-action"
                          onClick={() => retryUpload(u)}
                          title="Retry upload"
                          aria-label={`Retry uploading ${u.filename}`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                            <path d="M21 3v6h-6" />
                          </svg>
                          <span>Retry</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="upload-action upload-action-icon"
                        onClick={() => dismissUpload(u.id)}
                        title={u.status === "pending" ? "Remove file" : "Dismiss"}
                        aria-label={`${u.status === "pending" ? "Remove" : "Dismiss"} ${u.filename}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}

          {(pendingCount > 0 || ingesting || duplicateCount > 0) && (
            <div className="ingest-bar">
              <span className="ingest-bar-text">
                {ingesting
                  ? "Ingesting files — you can keep adding more."
                  : [
                      `${pendingCount} ${pendingCount === 1 ? "file" : "files"} ready to ingest`,
                      duplicateCount > 0 &&
                        `${duplicateCount} ${duplicateCount === 1 ? "duplicate" : "duplicates"} will be skipped`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </span>
              <div className="ingest-bar-actions">
                {hasClearable && !ingesting && (
                  <button type="button" className="btn-ghost" onClick={clearPending}>
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary ingest-submit"
                  onClick={ingestPending}
                  disabled={ingesting || pendingCount === 0}
                >
                  <ButtonLabel loading={ingesting} loadingText="Ingesting…">
                    Ingest {pendingCount > 1 ? `${pendingCount} files` : "file"}
                  </ButtonLabel>
                </button>
              </div>
            </div>
          )}

          <details className="paste-panel">
            <summary>Or paste text / markdown directly</summary>
            <form onSubmit={handlePasteSubmit} className="paste-form">
              {pasteError && (
                <div className="error-banner" role="alert">
                  {pasteError}
                </div>
              )}
              <FormField
                id="title"
                label="Title"
                error={paste.errorFor("title")}
                count={{ length: paste.values.title.length, max: LIMITS.ingestTitleMaxChars }}
              >
                <input
                  {...paste.field("title")}
                  type="text"
                  maxLength={LIMITS.ingestTitleMaxChars}
                  placeholder="e.g. Refund policy"
                />
              </FormField>
              <FormField
                id="content"
                label="Content"
                error={paste.errorFor("content")}
                count={{ length: paste.values.content.length, max: LIMITS.ingestTextMaxChars }}
              >
                <textarea
                  {...paste.field("content")}
                  rows={6}
                  maxLength={LIMITS.ingestTextMaxChars}
                  placeholder="Paste text or markdown…"
                />
              </FormField>
              <button className="btn-primary" type="submit" disabled={pasteSubmitting}>
                <ButtonLabel loading={pasteSubmitting} loadingText="Ingesting…">Ingest text</ButtonLabel>
              </button>
            </form>
          </details>

          <h2 className="section-title">Ingested documents</h2>
          {auth.status === "loading" || (docsLoading && !docsData) ? (
            <SkeletonList rows={3} variant="card" />
          ) : docsError && !docsData ? (
            <div className="error-banner" role="alert">
              Couldn&apos;t load your documents: {getErrorMessage(docsError)}
            </div>
          ) : !docsData?.documents?.length ? (
            <p className="empty-state">No documents yet — upload something above.</p>
          ) : (
            <ul className="conv-list">
              {documents.map((doc) => (
                <li key={doc.id} className="conv-item doc-item">
                  <FileTypeIcon filename={doc.title} size={40} />
                  <div className="doc-item-text">
                    <div className="conv-title">{doc.title}</div>
                    <div className="conv-date">
                      {fileTypeInfo(doc.title).name} · {formatAdded(doc.createdAt)}
                    </div>
                  </div>
                  <button className="btn-ghost btn-danger" onClick={() => handleDelete(doc)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
