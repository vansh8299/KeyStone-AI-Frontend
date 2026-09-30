"use client";

import { useState, useSyncExternalStore, FormEvent } from "react";
import { useApolloClient, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ButtonLabel, PageLoader } from "@/components/Loader";
import FormField from "@/components/FormField";
import { LOGIN } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { markSignedIn, safeNextPath, setPendingVerificationEmail } from "@/lib/session";
import { useGuestOnly } from "@/lib/useGuestOnly";
import { rules, useForm } from "@/lib/validation";

const validators = { email: rules.email, password: rules.loginPassword };

// Read straight from the URL (not useSearchParams, which would force a Suspense boundary for this
// statically rendered page). The query string doesn't change while the page is open.
const noSubscription = () => () => {};
const reasonInUrl = () => new URLSearchParams(window.location.search).get("reason");

export default function LoginPage() {
  const router = useRouter();
  const client = useApolloClient();
  const guest = useGuestOnly();
  const form = useForm({ email: "", password: "" }, validators);
  const [error, setError] = useState<ApiError | null>(null);
  const reason = useSyncExternalStore(noSubscription, reasonInUrl, () => null);
  const [login, { loading }] = useMutation(LOGIN);
  // Label shown from a successful response until the next page replaces this one, so the button
  // doesn't flip back to "Log in" while the app loads.
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const busy = loading || redirecting !== null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.validateAll()) return;
    try {
      await login({ variables: { input: { email: form.values.email.trim(), password: form.values.password } } });
      setRedirecting("Signed in — opening your chats…");
      markSignedIn();
      // Drop anything cached before signing in (e.g. the "signed out" answer, or a previous
      // user's data) so the app starts from the new session.
      await client.clearStore();
      router.push(safeNextPath());
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.code === "EMAIL_NOT_VERIFIED") {
        setRedirecting("Opening email verification…");
        setPendingVerificationEmail(apiError.email ?? form.values.email.trim());
        router.push(`/verify-email${window.location.search}`);
        return;
      }
      setRedirecting(null);
      if (!form.applyServerError(apiError.field, apiError.message)) setError(apiError);
    }
  }

  if (guest.redirecting) return <PageLoader />;

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to continue to your conversations.</p>

        {reason === "expired" && !error && (
          <div className="info-banner" role="status">
            Your session has expired. Please log in again.
          </div>
        )}
        {reason === "reset" && !error && (
          <div className="info-banner" role="status">
            Your password has been reset. Log in with your new password.
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField id="email" label="Email" error={form.errorFor("email")}>
            <input {...form.field("email")} type="email" autoComplete="email" inputMode="email" maxLength={254} readOnly={busy} required />
          </FormField>
          <FormField id="password" label="Password" error={form.errorFor("password")}>
            <input {...form.field("password")} type="password" autoComplete="current-password" readOnly={busy} required />
          </FormField>
          <div className="auth-forgot">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <button className="btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            <ButtonLabel loading={busy} loadingText={redirecting ?? "Logging in…"}>Log in</ButtonLabel>
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link href="/signup">Sign up</Link>
        </p>
      </div>
    </main>
  );
}
