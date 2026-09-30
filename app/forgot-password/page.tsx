"use client";

import { useState, FormEvent } from "react";
import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ButtonLabel, PageLoader } from "@/components/Loader";
import FormField from "@/components/FormField";
import CodeInput from "@/components/CodeInput";
import { REQUEST_PASSWORD_RESET, RESET_PASSWORD } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { passwordChecks, rules, useForm, type Validator } from "@/lib/validation";
import { useCooldown } from "@/lib/useCooldown";
import { useGuestOnly } from "@/lib/useGuestOnly";

const RESEND_COOLDOWN_SECONDS = 60;

type ResetValues = { email: string; code: string; newPassword: string; confirmPassword: string };

const emailValidators = { email: rules.email };
const resetValidators: { [K in keyof ResetValues]: Validator<ResetValues> } = {
  email: rules.email,
  code: rules.code,
  newPassword: rules.newPassword,
  confirmPassword: (value, values) =>
    !value ? "Please confirm your password." : value !== values.newPassword ? "Passwords don't match." : null,
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const guest = useGuestOnly();
  const [step, setStep] = useState<"email" | "reset">("email");
  const emailForm = useForm({ email: "" }, emailValidators);
  const form = useForm<ResetValues>({ email: "", code: "", newPassword: "", confirmPassword: "" }, resetValidators);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cooldown = useCooldown();
  const [requestReset, { loading: requesting }] = useMutation(REQUEST_PASSWORD_RESET);
  const [resetPassword, { loading: resetting }] = useMutation(RESET_PASSWORD);
  // Stays true after a successful reset until the login page replaces this one, so the button
  // doesn't flip back to "Reset password" while it loads.
  const [redirecting, setRedirecting] = useState(false);
  const busy = resetting || redirecting;

  async function sendCode(email: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      await requestReset({ variables: { email } });
      cooldown.start(RESEND_COOLDOWN_SECONDS);
      return true;
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.retryAfterSeconds) cooldown.start(apiError.retryAfterSeconds);
      setError(apiError);
      return false;
    }
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    if (!emailForm.validateAll()) return;
    const email = emailForm.values.email.trim();
    if (!(await sendCode(email))) return;
    form.setValue("email", email);
    setStep("reset");
  }

  async function handleResend() {
    if (await sendCode(form.values.email)) {
      form.setValue("code", "");
      setNotice("We've sent a new code. It may take a minute to arrive — check your spam folder too.");
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.validateAll()) return;
    const { email, code, newPassword } = form.values;
    try {
      await resetPassword({ variables: { input: { email, code: code.trim(), newPassword } } });
      setRedirecting(true);
      router.push("/login?reason=reset");
    } catch (err) {
      setRedirecting(false);
      const apiError = toApiError(err);
      if (!form.applyServerError(apiError.field, apiError.message)) setError(apiError);
    }
  }

  const banners = (
    <>
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
    </>
  );

  if (guest.redirecting) return <PageLoader />;

  if (step === "email") {
    return (
      <main className="auth-shell">
        <ThemeToggle className="auth-theme-toggle" />
        <div className="auth-card">
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">Enter your account email and we&apos;ll send you a code to reset your password.</p>
          {banners}
          <form onSubmit={handleRequest} noValidate>
            <FormField id="email" label="Email" error={emailForm.errorFor("email")}>
              <input {...emailForm.field("email")} type="email" autoComplete="email" inputMode="email" maxLength={254} required />
            </FormField>
            <button className="btn-primary" type="submit" disabled={requesting || cooldown.remaining > 0}>
              <ButtonLabel loading={requesting} loadingText="Sending code…">
                {cooldown.remaining > 0 ? `Send code (${cooldown.remaining}s)` : "Send code"}
              </ButtonLabel>
            </button>
          </form>
          <p className="auth-switch">
            Remembered it? <Link href="/login">Log in</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Enter your code</h1>
        <p className="auth-subtitle">
          If <strong>{form.values.email}</strong> has an account, we&apos;ve sent it a 6-digit code. Enter it and choose a new
          password.
        </p>
        {banners}
        <form onSubmit={handleReset} noValidate>
          <FormField id="code" label="Reset code" error={form.errorFor("code")}>
            <CodeInput {...form.field("code")} autoFocus readOnly={busy} required />
          </FormField>
          <FormField id="newPassword" label="New password" error={form.errorFor("newPassword")}>
            <input {...form.field("newPassword")} type="password" autoComplete="new-password" readOnly={busy} required />
          </FormField>
          <ul className="password-checks" aria-label="Password requirements">
            {passwordChecks(form.values.newPassword).map((check) => (
              <li key={check.label} className={check.met ? "met" : ""}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {check.met ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                {check.label}
                <span className="visually-hidden">{check.met ? " (met)" : " (not met)"}</span>
              </li>
            ))}
          </ul>
          <FormField id="confirmPassword" label="Confirm new password" error={form.errorFor("confirmPassword")}>
            <input {...form.field("confirmPassword")} type="password" autoComplete="new-password" readOnly={busy} required />
          </FormField>
          <button className="btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            <ButtonLabel loading={busy} loadingText={redirecting ? "Password reset — opening login…" : "Resetting…"}>
              Reset password
            </ButtonLabel>
          </button>
        </form>
        <p className="auth-switch">
          Didn&apos;t get it?{" "}
          <button type="button" className="link-button" onClick={handleResend} disabled={busy || requesting || cooldown.remaining > 0}>
            {cooldown.remaining > 0 ? `Resend code in ${cooldown.remaining}s` : requesting ? "Sending…" : "Resend code"}
          </button>
        </p>
        <p className="auth-switch auth-switch-tight">
          <button
            type="button"
            className="link-button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setNotice(null);
              form.reset();
              setStep("email");
            }}
          >
            Use a different email
          </button>
        </p>
      </div>
    </main>
  );
}
