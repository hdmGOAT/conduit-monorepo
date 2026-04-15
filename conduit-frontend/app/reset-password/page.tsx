"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

type APIError = {
  error?: string;
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-200 px-4 py-20">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-300/40">
            <p className="text-sm text-zinc-600">Loading reset form...</p>
          </div>
        </main>
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        let message = "Could not reset password";
        const payload = (await response.json().catch(() => null)) as APIError | null;
        if (payload?.error) {
          message = payload.error;
        }
        setError(message);
        return;
      }

      setSuccess(true);
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-200 px-4 py-20">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-300/40">
        <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-500">Conduit</p>
        <h1 className="text-2xl font-semibold text-zinc-900">Reset Password</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter your reset token and choose a new password.
        </p>

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Password reset successful.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="token">
            Reset token
          </label>
          <input
            id="token"
            name="token"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
            placeholder="Paste token"
          />

          <label className="block text-sm font-medium text-zinc-700" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            name="new-password"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
            placeholder="At least 8 characters"
          />

          <label className="block text-sm font-medium text-zinc-700" htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
            placeholder="Repeat password"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          <Link href="/" className="text-zinc-900 underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
