"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import appAPIClient from "@/lib/api/httpClient";
import { getAPIErrorMessage } from "@/lib/api/httpError";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        if (messages?.[0]) {
          errors[field] = messages[0];
        }
      });
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      await appAPIClient.post("/auth/forgot-password", { email });

      setSubmitted(true);
    } catch (error) {
      setError(getAPIErrorMessage(error, "Unable to reach the server. Try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recover Access"
      title="Forgot your password?"
      description="Enter your email and we'll send a reset link if the account exists."
      exitHref="/"
      footer={
        <div className="flex items-center justify-center gap-4 text-sm text-[#122038]/70">
          <Link href="/login" className="font-semibold text-[#122038] underline-offset-4 hover:underline">
            Sign In
          </Link>
          <span className="text-[#122038]/30">·</span>
          <Link href="/signup" className="font-semibold text-[#122038] underline-offset-4 hover:underline">
            Create Account
          </Link>
        </div>
      }
    >
      {submitted ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          If an account exists for this email, a password reset link has been sent.
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <AuthField
          label="Email"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          error={fieldErrors.email}
        />

        <AuthSubmitButton submitting={submitting} idleLabel="Send Reset Link" busyLabel="Sending..." />
      </form>
    </AuthShell>
  );
}
