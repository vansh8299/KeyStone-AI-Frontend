"use client";

import { useState, FormEvent } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { SIGNUP } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { safeNextPath } from "@/lib/session";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [signup, { loading }] = useMutation(SIGNUP);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signup({ variables: { input: { email, password, name: name || undefined } } });
      router.push(safeNextPath());
    } catch (err) {
      setError(toApiError(err));
    }
  }

  const fieldError = (field: string) => (error?.field === `input.${field}` ? error.message : null);
  const bannerError = error && !error.field?.startsWith("input.") ? error : null;

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start chatting with your documents.</p>

        {bannerError && (
          <div className="error-banner" role="alert">
            {bannerError.message}
            {bannerError.code === "CONFLICT" && (
              <>
                {" "}
                <Link href="/login">Log in</Link>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Field id="name" label="Name" error={fieldError("name")}>
            <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="email" label="Email" error={fieldError("email")}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldError("email"))}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field id="password" label="Password" error={fieldError("password")}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={Boolean(fieldError("password"))}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | null; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
