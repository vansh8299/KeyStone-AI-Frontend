"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Client-side rules. These mirror the backend's zod schemas (backend/src/modules/auth/auth.schemas.ts,
 * rag.schemas.ts, config/limits.ts) so users get instant feedback; the server still re-validates
 * everything and its field errors are mapped back onto the form.
 */
export const LIMITS = {
  emailMaxChars: 254,
  nameMaxChars: 100,
  passwordMinChars: 8,
  passwordMaxBytes: 72,
  ingestTitleMaxChars: 200,
  ingestTextMaxChars: 200_000,
  questionMaxChars: 4000,
  feedbackReasonMaxChars: 2000,
} as const;

export type Validator<V> = (value: string, values: V) => string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export const rules = {
  email: (value: string): string | null => {
    const v = value.trim();
    if (!v) return "Email is required.";
    if (v.length > LIMITS.emailMaxChars) return `Email must be at most ${LIMITS.emailMaxChars} characters.`;
    if (!EMAIL_RE.test(v)) return "Enter a valid email address, like name@example.com.";
    return null;
  },

  loginPassword: (value: string): string | null => (value ? null : "Password is required."),

  newPassword: (value: string): string | null => {
    if (!value) return "Password is required.";
    const unmet = passwordChecks(value).filter((c) => !c.met);
    if (unmet.length) {
      const parts = unmet.map((c) => c.requirement);
      const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
      return `Password must ${list}.`;
    }
    if (byteLength(value) > LIMITS.passwordMaxBytes) return "Password is too long.";
    return null;
  },

  name: (value: string): string | null => {
    const v = value.trim();
    if (v.length > LIMITS.nameMaxChars) return `Name must be at most ${LIMITS.nameMaxChars} characters.`;
    if (CONTROL_CHARS.test(v)) return "Name contains invalid characters.";
    return null;
  },

  requiredText: (label: string, max: number, singleLine = false) => (value: string): string | null => {
    const v = value.trim();
    if (!v) return `${label} is required.`;
    if (v.length > max) return `${label} must be at most ${max.toLocaleString()} characters.`;
    if (CONTROL_CHARS.test(v) || (singleLine && /[\t\n\r]/.test(v))) return `${label} contains invalid characters.`;
    return null;
  },
};

/** Password requirements, shown live as a checklist and used by `rules.newPassword`. */
export function passwordChecks(value: string) {
  return [
    { label: `At least ${LIMITS.passwordMinChars} characters`, requirement: `be at least ${LIMITS.passwordMinChars} characters`, met: value.length >= LIMITS.passwordMinChars },
    { label: "One letter", requirement: "include a letter", met: /\p{L}/u.test(value) },
    { label: "One number", requirement: "include a number", met: /\p{N}/u.test(value) },
  ];
}

type Values = Record<string, string>;

/**
 * Minimal form state with validation. Errors appear once a field is blurred or the form is
 * submitted, then update live as the user types so they disappear the moment the input is fixed.
 */
export function useForm<V extends Values>(initial: V, validators: { [K in keyof V]?: Validator<V> }) {
  const [values, setValues] = useState<V>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof V, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof V, string>>>({});
  const refs = useRef<Partial<Record<keyof V, HTMLElement | null>>>({});

  const validateField = useCallback(
    (name: keyof V, all: V = values) => validators[name]?.(all[name], all) ?? null,
    [validators, values]
  );

  const errorFor = (name: keyof V): string | null =>
    serverErrors[name] ?? (touched[name] ? validateField(name) : null);

  const setValue = (name: keyof V, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setServerErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  /** Marks every field touched; returns true when valid, otherwise focuses the first invalid field. */
  const validateAll = (): boolean => {
    const names = Object.keys(values) as (keyof V)[];
    setTouched(Object.fromEntries(names.map((n) => [n, true])) as Record<keyof V, boolean>);
    const firstInvalid = names.find((n) => validateField(n));
    if (firstInvalid) {
      refs.current[firstInvalid]?.focus();
      return false;
    }
    return true;
  };

  /** Shows a server-side field error (e.g. "input.email") on the matching field; returns whether it matched. */
  const applyServerError = (field: string | undefined, message: string): boolean => {
    const name = field?.split(".").pop() as keyof V | undefined;
    if (!name || !(name in values)) return false;
    setServerErrors((prev) => ({ ...prev, [name]: message }));
    refs.current[name]?.focus();
    return true;
  };

  const reset = () => {
    setValues(initial);
    setTouched({});
    setServerErrors({});
  };

  /** Props to spread onto an <input>/<textarea> for the named field. */
  const field = (name: keyof V & string) => {
    const error = errorFor(name);
    return {
      id: name,
      name,
      value: values[name],
      ref: (el: HTMLInputElement | HTMLTextAreaElement | null) => {
        refs.current[name] = el;
      },
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(name, e.target.value),
      onBlur: () => {
        // Don't nag about an untouched empty field just because focus passed through it.
        if (values[name] !== initial[name]) setTouched((prev) => ({ ...prev, [name]: true }));
      },
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? `${name}-error` : undefined,
    };
  };

  return { values, setValue, errorFor, field, validateAll, applyServerError, reset };
}
