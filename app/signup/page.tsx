"use client";

import { useState, FormEvent } from "react";
import { useApolloClient, useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { ButtonLabel } from "@/components/Loader";
import FormField from "@/components/FormField";
import { SIGNUP } from "@/lib/graphql/auth";
import { ApiError, toApiError } from "@/lib/errors";
import { safeNextPath } from "@/lib/session";
import { LIMITS, passwordChecks, rules, useForm, type Validator } from "@/lib/validation";

type SignupValues = { name: string; email: string; password: string; confirmPassword: string };

const validators: { [K in keyof SignupValues]: Validator<SignupValues> } = {
  name: rules.name,
  email: rules.email,
  password: rules.newPassword,
  confirmPassword: (value, values) =>
    !value ? "Please confirm your password." : value !== values.password ? "Passwords don't match." : null,
};

export default function SignupPage() {
  const router = useRouter();
  const client = useApolloClient();
  const form = useForm<SignupValues>({ name: "", email: "", password: "", confirmPassword: "" }, validators);
  const [error, setError] = useState<ApiError | null>(null);
  const [signup, { loading }] = useMutation(SIGNUP);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.validateAll()) return;
    const { name, email, password } = form.values;
    try {
      await signup({ variables: { input: { email: email.trim(), password, name: name.trim() || undefined } } });
      // Drop anything cached before signing in (e.g. the "signed out" answer, or a previous
      // user's data) so the app starts from the new session.
      await client.clearStore();
      router.push(safeNextPath());
    } catch (err) {
      const apiError = toApiError(err);
      if (!form.applyServerError(apiError.field, apiError.message)) setError(apiError);
    }
  }

  const password = form.values.password;

  return (
    <main className="auth-shell">
      <ThemeToggle className="auth-theme-toggle" />
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Start chatting with your documents.</p>

        {error && (
          <div className="error-banner" role="alert">
            {error.message}
            {error.code === "CONFLICT" && (
              <>
                {" "}
                <Link href="/login">Log in</Link>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField id="name" label="Name" optional error={form.errorFor("name")}>
            <input {...form.field("name")} type="text" autoComplete="name" maxLength={LIMITS.nameMaxChars} />
          </FormField>
          <FormField id="email" label="Email" error={form.errorFor("email")}>
            <input {...form.field("email")} type="email" autoComplete="email" inputMode="email" maxLength={LIMITS.emailMaxChars} required />
          </FormField>
          <FormField id="password" label="Password" error={form.errorFor("password")}>
            <input {...form.field("password")} type="password" autoComplete="new-password" required />
          </FormField>
          <ul className="password-checks" aria-label="Password requirements">
            {passwordChecks(password).map((check) => (
              <li key={check.label} className={check.met ? "met" : ""}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {check.met ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                {check.label}
                <span className="visually-hidden">{check.met ? " (met)" : " (not met)"}</span>
              </li>
            ))}
          </ul>
          <FormField id="confirmPassword" label="Confirm password" error={form.errorFor("confirmPassword")}>
            <input {...form.field("confirmPassword")} type="password" autoComplete="new-password" required />
          </FormField>
          <button className="btn-primary" type="submit" disabled={loading}>
            <ButtonLabel loading={loading} loadingText="Creating account…">Sign up</ButtonLabel>
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
