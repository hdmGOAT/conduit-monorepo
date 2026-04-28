"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import appAPIClient from "@/lib/api/httpClient";
import { getAPIErrorMessage } from "@/lib/api/httpError";
import { AuthField, AuthInlineLink } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { loginSchema } from "@/lib/validators/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    const result = loginSchema.safeParse({ email, password });
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
      await appAPIClient.post("/auth/login", { email, password });

      router.push("/groups");
    } catch (error) {
      setError(getAPIErrorMessage(error, "Unable to reach the server. Try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome"
      title="Sign in to Conduit"
      description="Use your account email and password to continue."
      exitHref="/"
      footer={
        <div className="text-center text-sm text-[#122038]/70">
          <span>Need an account? </span>
          <Link
            href="/signup"
            className="font-semibold text-[#122038] underline-offset-4 hover:underline"
          >
            Sign Up
          </Link>
        </div>
      }
    >
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
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="curator@conduit.app"
          error={fieldErrors.email}
        />

        <AuthField
          label="Password"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          trailingContent={<AuthInlineLink href="/forgot-password" label="Forgot Password?" />}
          error={fieldErrors.password}
        />

        <AuthSubmitButton submitting={submitting} idleLabel="Sign In" busyLabel="Signing In..." />
      </form>
    </AuthShell>
  );
}
