type Glyph = "text" | "grid" | "pdf" | "image" | "code" | "blank";

interface FileTypeInfo {
  /** Short label printed on the icon's band. */
  label: string;
  /** Human-friendly format name, e.g. "Excel spreadsheet". */
  name: string;
  /** Brand-ish colour people associate with the format. */
  color: string;
  glyph: Glyph;
}

const TYPES: Record<string, FileTypeInfo> = {
  pdf: { label: "PDF", name: "PDF document", color: "#e5484d", glyph: "pdf" },
  doc: { label: "DOC", name: "Word document", color: "#2b7cd3", glyph: "text" },
  docx: { label: "DOC", name: "Word document", color: "#2b7cd3", glyph: "text" },
  rtf: { label: "RTF", name: "Rich text document", color: "#2b7cd3", glyph: "text" },
  xls: { label: "XLS", name: "Excel spreadsheet", color: "#1f9d55", glyph: "grid" },
  xlsx: { label: "XLS", name: "Excel spreadsheet", color: "#1f9d55", glyph: "grid" },
  csv: { label: "CSV", name: "CSV spreadsheet", color: "#0e9384", glyph: "grid" },
  md: { label: "MD", name: "Markdown", color: "#7c5cff", glyph: "code" },
  markdown: { label: "MD", name: "Markdown", color: "#7c5cff", glyph: "code" },
  txt: { label: "TXT", name: "Text file", color: "#64748b", glyph: "text" },
  png: { label: "PNG", name: "Image", color: "#d97706", glyph: "image" },
  jpg: { label: "JPG", name: "Image", color: "#d97706", glyph: "image" },
  jpeg: { label: "JPG", name: "Image", color: "#d97706", glyph: "image" },
  webp: { label: "WEBP", name: "Image", color: "#d97706", glyph: "image" },
  gif: { label: "GIF", name: "Image", color: "#d97706", glyph: "image" },
};

const UNKNOWN: FileTypeInfo = { label: "FILE", name: "File", color: "#6b7280", glyph: "blank" };

export function fileTypeInfo(filename: string): FileTypeInfo {
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".") + 1).toLowerCase() : "";
  return TYPES[ext] ?? UNKNOWN;
}

/** A page-with-folded-corner icon, coloured and labelled by file format. Decorative: pair it with the file name. */
export default function FileTypeIcon({ filename, size = 36 }: { filename: string; size?: number }) {
  const { label, color, glyph } = fileTypeInfo(filename);
  const fontSize = label.length > 3 ? 6.2 : 7.4;
  return (
    <svg
      className="file-type-icon"
      width={size * 0.8}
      height={size}
      viewBox="0 0 32 40"
      aria-hidden="true"
      style={{ ["--ft-color" as string]: color }}
    >
      {/* page */}
      <path d="M4 1.5h16.5L29.5 10.5V36a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 36V4A2.5 2.5 0 0 1 4 1.5z" className="ft-page" />
      {/* folded corner */}
      <path d="M20.5 1.5v6.5a2.5 2.5 0 0 0 2.5 2.5h6.5" className="ft-fold" />
      <Glyph kind={glyph} />
      {/* label band */}
      <rect x="0" y="23" width="24" height="11" rx="2" className="ft-band" />
      <text x="12" y="30.6" textAnchor="middle" fontSize={fontSize} className="ft-label">
        {label}
      </text>
    </svg>
  );
}

function Glyph({ kind }: { kind: Glyph }) {
  switch (kind) {
    case "text":
      return <path d="M7 10h10M7 14h16M7 18h13" className="ft-glyph" />;
    case "grid":
      return <path d="M7 9.5h16v11H7zM7 13.2h16M7 16.9h16M12.3 9.5v11M17.6 9.5v11" className="ft-glyph" />;
    case "pdf":
      return <path d="M9 19.5c3-1.5 5.5-6 6-10.5.4 3.5 3 7.5 7 9-3.5-.5-9 .2-13 1.5z" className="ft-glyph" />;
    case "image":
      return (
        <>
          <circle cx="11" cy="11" r="2" className="ft-glyph-fill" />
          <path d="M6.5 20.5l5-5 3 3 3.5-4 5.5 6" className="ft-glyph" />
        </>
      );
    case "code":
      return <path d="M11 10l-4 4 4 4M19 10l4 4-4 4M16 9l-2 10" className="ft-glyph" />;
    default:
      return null;
  }
}
