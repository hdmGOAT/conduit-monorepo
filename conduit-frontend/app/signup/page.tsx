"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import appAPIClient from "@/lib/api/httpClient";
import { getAPIErrorMessage } from "@/lib/api/httpError";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signupSchema } from "@/lib/validators/auth";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    const result = signupSchema.safeParse({
      displayName,
      email,
      password,
      confirmPassword,
    });

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
      await appAPIClient.post("/auth/signup", {
        email,
        password,
        display_name: displayName,
      });
      router.push("/");
    } catch (error) {
      setError(getAPIErrorMessage(error, "Unable to create account. Try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Join Conduit"
      title="Create your account"
      description="Set up your account to start creating groups and collecting payments."
      exitHref="/"
      footer={
        <div className="text-center text-sm text-[#122038]/70">
          <span>Already have an account? </span>
          <Link
            href="/login"
            className="font-semibold text-[#122038] underline-offset-4 hover:underline"
          >
            Sign In
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
          label="Display Name"
          id="display-name"
          name="display-name"
          type="text"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Conduit Curator"
          error={fieldErrors.displayName}
        />

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
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          error={fieldErrors.password}
        />

        <AuthField
          label="Confirm Password"
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat your password"
          error={fieldErrors.confirmPassword}
        />

        <AuthSubmitButton submitting={submitting} idleLabel="Create Account" busyLabel="Creating Account..." />
      </form>
    </AuthShell>
  );
}
