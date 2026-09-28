"use client";

import { useEffect, useState, FormEvent } from "react";
import { useApolloClient, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ButtonLabel } from "@/components/Loader";
import FormField from "@/components/FormField";
import CodeInput from "@/components/CodeInput";
import { RESEND_VERIFICATION_CODE, VERIFY_EMAIL } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { clearPendingVerificationEmail, getPendingVerificationEmail, safeNextPath } from "@/lib/session";
import { rules, useForm } from "@/lib/validation";
import { useCooldown } from "@/lib/useCooldown";

const RESEND_COOLDOWN_SECONDS = 60;
const validators = { email: rules.email, code: rules.code };

export default function VerifyEmailPage() {
  const router = useRouter();
  const client = useApolloClient();
  const form = useForm({ email: "", code: "" }, validators);
  const [knownEmail, setKnownEmail] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS);
  const [verifyEmail, { loading }] = useMutation(VERIFY_EMAIL);
  const [resendCode, { loading: resending }] = useMutation(RESEND_VERIFICATION_CODE);

  // Picked up after mount: sessionStorage isn't available during prerendering.
  useEffect(() => {
    const pending = getPendingVerificationEmail();
    if (pending) {
      form.setValue("email", pending);
      setKnownEmail(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.validateAll()) return;
    try {
      await verifyEmail({ variables: { input: { email: form.values.email.trim(), code: form.values.code.trim() } } });
      clearPendingVerificationEmail();
      await client.clearStore();
      router.push(safeNextPath());
    } catch (err) {
      const apiError = toApiError(err);
      if (!form.applyServerError(apiError.field, apiError.message)) setError(apiError);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const emailError = rules.email(form.values.email);
    if (emailError) {
      form.applyServerError("email", emailError);
      return;
    }
    try {
      await resendCode({ variables: { email: form.values.email.trim() } });
      form.setValue("code", "");
      setNotice("We've sent a new code. It may take a minute to arrive — check your spam folder too.");
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.retryAfterSeconds) cooldown.start(apiError.retryAfterSeconds);
      setError(apiError);
    }
  }

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Check your email</h1>
        <p className="auth-subtitle">
          {knownEmail ? (
            <>
              We sent a 6-digit code to <strong>{form.values.email}</strong>. Enter it below to verify your account.
            </>
          ) : (
            "Enter your email and the 6-digit code we sent you."
          )}
        </p>

        {notice && !error && (
          <div className="info-banner" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {!knownEmail && (
            <FormField id="email" label="Email" error={form.errorFor("email")}>
              <input {...form.field("email")} type="email" autoComplete="email" inputMode="email" maxLength={254} required />
            </FormField>
          )}
          <FormField id="code" label="Verification code" error={form.errorFor("code")}>
            <CodeInput {...form.field("code")} autoFocus={knownEmail} required />
          </FormField>
          <button className="btn-primary" type="submit" disabled={loading}>
            <ButtonLabel loading={loading} loadingText="Verifying…">Verify email</ButtonLabel>
          </button>
        </form>

        <p className="auth-switch">
          Didn&apos;t get it?{" "}
          <button type="button" className="link-button" onClick={handleResend} disabled={resending || cooldown.remaining > 0}>
            {cooldown.remaining > 0 ? `Resend code in ${cooldown.remaining}s` : resending ? "Sending…" : "Resend code"}
          </button>
        </p>
        <p className="auth-switch auth-switch-tight">
          Wrong email? <Link href="/signup">Sign up again</Link>
        </p>
      </div>
    </main>
  );
}
