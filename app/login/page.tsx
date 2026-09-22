"use client";

import { useState, useEffect, FormEvent } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { LOGIN } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { safeNextPath } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [login, { loading }] = useMutation(LOGIN);

  useEffect(() => {
    setSessionExpired(new URLSearchParams(window.location.search).get("reason") === "expired");
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ variables: { input: { email, password } } });
      router.push(safeNextPath());
    } catch (err) {
      setError(toApiError(err));
    }
  }

  const emailError = error?.field === "input.email" ? error.message : null;
  const bannerError = error && !emailError ? error : null;

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to continue to your conversations.</p>

        {sessionExpired && !error && (
          <div className="info-banner" role="status">
            Your session has expired. Please log in again.
          </div>
        )}
        {bannerError && (
          <div className="error-banner" role="alert">
            {bannerError.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={Boolean(emailError)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailError && <div className="field-error">{emailError}</div>}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
