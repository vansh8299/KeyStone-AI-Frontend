"use client";

import { useEffect, useRef, useState } from "react";
import { ACCEPTED_IMAGE_TYPES, DOCUMENT_EXTENSIONS } from "@/lib/fileUpload";

interface AttachMenuProps {
  disabled?: boolean;
  canAddMore: boolean;
  onFiles: (files: File[]) => void;
}

const OPTIONS = [
  {
    key: "files",
    label: "Add files",
    hint: "PDF, Word, Excel, CSV, text",
    accept: DOCUMENT_EXTENSIONS.join(","),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    key: "images",
    label: "Add images",
    hint: "PNG, JPEG, WebP, GIF",
    accept: ACCEPTED_IMAGE_TYPES.join(","),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    ),
  },
] as const;

export default function AttachMenu({ disabled = false, canAddMore, onFiles }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const title = !canAddMore ? "You can attach up to 4 files" : "Attach files or images";

  return (
    <div className="attach-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`chat-attach ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        disabled={disabled || !canAddMore}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>

      {open && (
        <div className="attach-menu-list" role="menu" aria-label="Attach" onKeyDown={onMenuKeyDown}>
          {OPTIONS.map((option, i) => (
            <button
              key={option.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              className="attach-menu-item"
              onClick={() => {
                close(false);
                inputRefs.current[option.key]?.click();
              }}
            >
              <span className="attach-menu-icon">{option.icon}</span>
              <span className="attach-menu-text">
                <span className="attach-menu-label">{option.label}</span>
                <span className="attach-menu-hint">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {OPTIONS.map((option) => (
        <input
          key={option.key}
          ref={(el) => {
            inputRefs.current[option.key] = el;
          }}
          type="file"
          accept={option.accept}
          multiple
          hidden
          data-attach={option.key}
          onChange={(e) => {
            if (e.target.files?.length) onFiles(Array.from(e.target.files));
            e.target.value = "";
            buttonRef.current?.focus();
          }}
        />
      ))}
    </div>
  );
}
