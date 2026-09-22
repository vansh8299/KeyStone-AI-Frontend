"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import {
  INGEST_FILE,
  INGEST_TEXT,
  DELETE_INGESTED_DOCUMENT,
  DOCUMENTS,
} from "@/lib/graphql/rag";
import { ME } from "@/lib/graphql/auth";
import Header from "@/components/Header";
import { useToast } from "@/components/Toaster";
import { getErrorMessage } from "@/lib/errors";

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

interface UploadItem {
  id: string;
  filename: string;
  status: "uploading" | "done" | "error";
  chunkCount?: number;
  pipeline?: string;
  error?: string;
}

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { data: meData, loading: meLoading } = useQuery(ME, { fetchPolicy: "network-only" });

  const { data: docsData, loading: docsLoading, error: docsError, refetch } = useQuery(DOCUMENTS, {
    fetchPolicy: "network-only",
    skip: meLoading || !meData?.me,
  });

  const [ingestFile] = useMutation(INGEST_FILE);
  const [ingestText] = useMutation(INGEST_TEXT);
  const [deleteDoc] = useMutation(DELETE_INGESTED_DOCUMENT);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError, showInfo } = useToast();

  useEffect(() => {
    if (!meLoading && !meData?.me) router.replace("/login");
  }, [meLoading, meData, router]);

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const localId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const problem = checkFile(file);
      if (problem) {
        setUploads((prev) => [...prev, { id: localId, filename: file.name, status: "error", error: problem }]);
        continue;
      }

      setUploads((prev) => [...prev, { id: localId, filename: file.name, status: "uploading" }]);

      try {
        const { data } = await ingestFile({ variables: { file } });
        setUploads((prev) =>
          prev.map((u) =>
            u.id === localId
              ? {
                  ...u,
                  status: "done",
                  chunkCount: data.ingestFile.chunkCount,
                  pipeline: data.ingestFile.pipeline,
                }
              : u
          )
        );
        refetch();
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === localId
              ? { ...u, status: "error", error: getErrorMessage(err) }
              : u
          )
        );
      }
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  async function handlePasteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasteError(null);
    if (!pasteTitle.trim() || !pasteContent.trim()) {
      setPasteError("Please enter both a title and some content.");
      return;
    }
    setPasteSubmitting(true);
    try {
      await ingestText({ variables: { input: { title: pasteTitle, content: pasteContent } } });
      showInfo(`"${pasteTitle.trim()}" was added to the knowledge base.`);
      setPasteTitle("");
      setPasteContent("");
      refetch();
    } catch (err) {
      setPasteError(getErrorMessage(err));
    } finally {
      setPasteSubmitting(false);
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await deleteDoc({ variables: { documentId } });
      refetch();
    } catch (err) {
      showError(err);
    }
  }

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
            <p className="dropzone-title">Drag & drop files here, or click to browse</p>
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
              {uploads.map((u) => (
                <li key={u.id} className={`upload-item upload-${u.status}`}>
                  <span className="upload-filename">{u.filename}</span>
                  {u.status === "uploading" && <span className="upload-status">Uploading…</span>}
                  {u.status === "done" && (
                    <span className="upload-status">
                      ✓ {u.chunkCount} chunks · {u.pipeline} pipeline
                    </span>
                  )}
                  {u.status === "error" && <span className="upload-status upload-error-text">{u.error}</span>}
                </li>
              ))}
            </ul>
          )}

          <details className="paste-panel">
            <summary>Or paste text / markdown directly</summary>
            <form onSubmit={handlePasteSubmit} className="paste-form">
              {pasteError && (
                <div className="error-banner" role="alert">
                  {pasteError}
                </div>
              )}
              <div className="field">
                <label htmlFor="paste-title">Title</label>
                <input
                  id="paste-title"
                  type="text"
                  value={pasteTitle}
                  maxLength={200}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Refund policy"
                />
              </div>
              <div className="field">
                <label htmlFor="paste-content">Content</label>
                <textarea
                  id="paste-content"
                  rows={6}
                  value={pasteContent}
                  maxLength={200000}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste text or markdown…"
                />
              </div>
              <button className="btn-primary" type="submit" disabled={pasteSubmitting}>
                {pasteSubmitting ? "Ingesting…" : "Ingest text"}
              </button>
            </form>
          </details>

          <h2 className="section-title">Ingested documents</h2>
          {docsLoading ? (
            <p className="empty-state">Loading…</p>
          ) : docsError && !docsData ? (
            <div className="error-banner" role="alert">
              Couldn&apos;t load your documents: {getErrorMessage(docsError)}
            </div>
          ) : !docsData?.documents?.length ? (
            <p className="empty-state">No documents yet — upload something above.</p>
          ) : (
            <ul className="conv-list">
              {docsData.documents.map((doc: { id: string; title: string; createdAt: string }) => (
                <li key={doc.id} className="conv-item doc-item">
                  <div>
                    <div className="conv-title">{doc.title}</div>
                    <div className="conv-date">{new Date(doc.createdAt).toLocaleString()}</div>
                  </div>
                  <button className="btn-ghost btn-danger" onClick={() => handleDelete(doc.id)}>
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
