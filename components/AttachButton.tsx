"use client";

import { useRef } from "react";
import { CHAT_FILE_ACCEPT, MAX_FILES_PER_MESSAGE } from "@/lib/fileUpload";

interface AttachButtonProps {
  disabled?: boolean;
  canAddMore: boolean;
  onFiles: (files: File[]) => void;
}

/** One paperclip, one picker: images and documents are chosen together and sorted by type later. */
export default function AttachButton({ disabled = false, canAddMore, onFiles }: AttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const title = canAddMore
    ? "Attach files or images — PDF, Word, Excel, CSV, text, PNG, JPEG, WebP, GIF"
    : `You can attach up to ${MAX_FILES_PER_MESSAGE} files`;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="chat-attach"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || !canAddMore}
        title={title}
        aria-label={canAddMore ? "Attach files or images" : title}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={CHAT_FILE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
          buttonRef.current?.focus();
        }}
      />
    </>
  );
}
