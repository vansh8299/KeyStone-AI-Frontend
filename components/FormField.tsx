interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
  optional?: boolean;
  /** Current length and maximum; the counter appears once the value is past 80% of the limit. */
  count?: { length: number; max: number };
  children: React.ReactNode;
}

export default function FormField({ id, label, error, hint, optional, count, children }: FormFieldProps) {
  const showCount = count && count.length > count.max * 0.8;
  return (
    <div className={`field ${error ? "field-invalid" : ""}`}>
      <label htmlFor={id}>
        {label}
        {optional && <span className="field-optional"> (optional)</span>}
      </label>
      {children}
      {(error || hint || showCount) && (
        <div className="field-footer">
          {error ? (
            <div id={`${id}-error`} className="field-error" role="alert">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {error}
            </div>
          ) : (
            hint && <div className="field-hint">{hint}</div>
          )}
          {showCount && (
            <span className={`field-count ${count.length > count.max ? "over" : ""}`}>
              {count.length.toLocaleString()}/{count.max.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
