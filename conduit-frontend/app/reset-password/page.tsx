"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import appAPIClient from "@/lib/api/httpClient";
import { getAPIErrorMessage } from "@/lib/api/httpError";
import { AuthField } from "@/components/auth/auth-field";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { resetPasswordSchema } from "@/lib/validators/auth";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          eyebrow="Recover Access"
          title="Reset your password"
          description="Use your reset token and choose a new password to continue."
          exitHref="/"
        >
          <div className="text-sm text-[#122038]/70">Loading reset form...</div>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const tokenFromURL = useMemo(() => params.get("token") ?? "", [params]);

  const [token, setToken] = useState(tokenFromURL);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setError(null);

    const result = resetPasswordSchema.safeParse({
      token,
      newPassword,
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
      await appAPIClient.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });

      setSuccess(true);
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(getAPIErrorMessage(error, "Unable to reach the server. Try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Recover Access"
      title="Reset your password"
      description="Use your reset token and choose a new password to continue."
      exitHref="/"
      footer={
        <div className="flex items-center justify-center gap-4 text-sm text-[#122038]/70">
          <Link href="/login" className="font-semibold text-[#122038] underline-offset-4 hover:underline">
            Sign In
          </Link>
          <span className="text-[#122038]/30">·</span>
          <Link href="/forgot-password" className="font-semibold text-[#122038] underline-offset-4 hover:underline">
            Forgot Password
          </Link>
        </div>
      }
    >
      {success ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Password reset successful.
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={onSubmit}>
        <AuthField
          label="Reset token"
          id="token"
          name="token"
          required
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste token"
          error={fieldErrors.token}
        />

        <AuthField
          label="New password"
          id="new-password"
          name="new-password"
          type="password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="At least 8 characters"
          error={fieldErrors.newPassword}
        />

        <AuthField
          label="Confirm password"
          id="confirm-password"
          name="confirm-password"
          type="password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat password"
          error={fieldErrors.confirmPassword}
        />

        <AuthSubmitButton submitting={submitting} idleLabel="Reset Password" busyLabel="Resetting..." />
      </form>
    </AuthShell>
  );
}
