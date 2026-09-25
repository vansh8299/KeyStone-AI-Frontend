interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Inline ring spinner; inherits color from its parent. */
export function Spinner({ size = 16, className = "", label }: SpinnerProps) {
  return (
    <span
      className={`spinner ${className}`}
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Button content that swaps to a spinner + label while busy, keeping the button's width steady. */
export function ButtonLabel({ loading, loadingText, children }: {
  loading: boolean;
  loadingText: string;
  children: React.ReactNode;
}) {
  if (!loading) return <>{children}</>;
  return (
    <span className="btn-loading">
      <Spinner size={14} />
      {loadingText}
    </span>
  );
}

/** Three-dot "assistant is typing" indicator, with an optional status caption. */
export function TypingIndicator({ label }: { label?: string }) {
  return (
    <span className="typing" role="status" aria-label={label ?? "Assistant is thinking"}>
      <span className="typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {label && <span className="typing-label">{label}</span>}
    </span>
  );
}

/** Full-viewport loader shown while the app decides where to send the user. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-label={label}>
      <div className="page-loader-mark" aria-hidden="true">
        <span className="page-loader-ring" />
        <span className="page-loader-core">K</span>
      </div>
      <span className="page-loader-text">Keystone AI</span>
    </div>
  );
}

export function Skeleton({ width, height = 12, className = "" }: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

/** Placeholder rows for a list of titled items (sidebar conversations, documents). */
export function SkeletonList({ rows = 5, variant = "sidebar" }: { rows?: number; variant?: "sidebar" | "card" }) {
  const widths = ["78%", "62%", "85%", "55%", "70%", "66%"];
  return (
    <ul className={`skeleton-list skeleton-list-${variant}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="skeleton-row">
          <Skeleton width={widths[i % widths.length]} height={12} />
          <Skeleton width="38%" height={9} />
        </li>
      ))}
    </ul>
  );
}

/** Placeholder chat transcript shown while a conversation's history loads. */
export function ChatSkeleton() {
  return (
    <div className="chat-skeleton" role="status" aria-label="Loading conversation">
      <Skeleton className="chat-skeleton-user" width="46%" height={40} />
      <div className="chat-skeleton-assistant">
        <Skeleton width="92%" height={12} />
        <Skeleton width="84%" height={12} />
        <Skeleton width="60%" height={12} />
      </div>
      <Skeleton className="chat-skeleton-user" width="34%" height={40} />
      <div className="chat-skeleton-assistant">
        <Skeleton width="88%" height={12} />
        <Skeleton width="72%" height={12} />
      </div>
    </div>
  );
}
