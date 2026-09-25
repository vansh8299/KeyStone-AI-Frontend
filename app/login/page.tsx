"use client";

import { useState, useSyncExternalStore, FormEvent } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ButtonLabel } from "@/components/Loader";
import FormField from "@/components/FormField";
import { LOGIN } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { safeNextPath } from "@/lib/session";
import { rules, useForm } from "@/lib/validation";

const validators = { email: rules.email, password: rules.loginPassword };

// Read straight from the URL (not useSearchParams, which would force a Suspense boundary for this
// statically rendered page). The query string doesn't change while the page is open.
const noSubscription = () => () => {};
const sessionExpiredInUrl = () => new URLSearchParams(window.location.search).get("reason") === "expired";

export default function LoginPage() {
  const router = useRouter();
  const form = useForm({ email: "", password: "" }, validators);
  const [error, setError] = useState<ApiError | null>(null);
  const sessionExpired = useSyncExternalStore(noSubscription, sessionExpiredInUrl, () => false);
  const [login, { loading }] = useMutation(LOGIN);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.validateAll()) return;
    try {
      await login({ variables: { input: { email: form.values.email.trim(), password: form.values.password } } });
      router.push(safeNextPath());
    } catch (err) {
      const apiError = toApiError(err);
      if (!form.applyServerError(apiError.field, apiError.message)) setError(apiError);
    }
  }

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
        {error && (
          <div className="error-banner" role="alert">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField id="email" label="Email" error={form.errorFor("email")}>
            <input {...form.field("email")} type="email" autoComplete="email" inputMode="email" maxLength={254} required />
          </FormField>
          <FormField id="password" label="Password" error={form.errorFor("password")}>
            <input {...form.field("password")} type="password" autoComplete="current-password" required />
          </FormField>
          <button className="btn-primary" type="submit" disabled={loading}>
            <ButtonLabel loading={loading} loadingText="Logging in…">Log in</ButtonLabel>
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
