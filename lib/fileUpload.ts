import { GRAPHQL_URL } from "./session";

export const MAX_FILES_PER_MESSAGE = 4;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".csv", ".xlsx", ".xls"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

/** `accept` value for a single picker that takes both images and documents. Extensions are listed
 * alongside MIME types because some OS file dialogs filter only on one or the other. */
export const CHAT_FILE_ACCEPT = [...ACCEPTED_IMAGE_TYPES, ...IMAGE_EXTENSIONS, ...DOCUMENT_EXTENSIONS].join(",");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 2048;
const REENCODE_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export class FileRejectedError extends Error {}

/**
 * SHA-256 (hex) of a file's bytes — the same hash the backend stores per document, so the page can
 * spot content that's already in the knowledge base before uploading. Null when Web Crypto isn't
 * available (non-secure context); the server still rejects duplicates in that case.
 */
export async function sha256Hex(file: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new FileRejectedError("This image couldn't be opened. It may be damaged."));
    };
    img.src = url;
  });
}

export async function prepareImage(file: File): Promise<File> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new FileRejectedError(`"${file.name}" isn't a supported image. Use PNG, JPEG, WebP or GIF.`);
  }
  if (file.size === 0) throw new FileRejectedError(`"${file.name}" is empty.`);
  if (file.size > MAX_SOURCE_BYTES) {
    throw new FileRejectedError(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(0)} MB).`);
  }

  const img = await loadImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_DIMENSION && (file.size <= REENCODE_ABOVE_BYTES || file.type === "image/gif")) {
    if (file.size > MAX_UPLOAD_BYTES) throw new FileRejectedError(`"${file.name}" is larger than 5 MB.`);
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new FileRejectedError(`"${file.name}" couldn't be processed.`);
  if (blob.size > MAX_UPLOAD_BYTES) throw new FileRejectedError(`"${file.name}" is still larger than 5 MB after resizing.`);
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export type FileKind = "image" | "document";

function extensionOf(name: string): string {
  return name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

export function fileKind(file: File): FileKind | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return "image";
  if (DOCUMENT_EXTENSIONS.includes(extensionOf(file.name))) return "document";
  return null;
}

export async function prepareFile(file: File): Promise<File> {
  const kind = fileKind(file);
  if (kind === "image") return prepareImage(file);
  if (kind === "document") {
    if (file.size === 0) throw new FileRejectedError(`"${file.name}" is empty.`);
    if (file.size > MAX_DOCUMENT_BYTES) {
      throw new FileRejectedError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — documents can be at most 20 MB.`);
    }
    return file;
  }
  throw new FileRejectedError(
    extensionOf(file.name) === ".doc"
      ? `"${file.name}" is an old Word .doc file. Save it as .docx and attach it again.`
      : `"${file.name}" can't be attached. Use an image (PNG, JPEG, WebP, GIF) or a document (PDF, Word .docx, Excel, CSV, .txt, Markdown).`
  );
}

export function attachmentUrl(id: string): string {
  return `${new URL(GRAPHQL_URL).origin}/attachments/${encodeURIComponent(id)}`;
}
