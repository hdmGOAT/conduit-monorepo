"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type APIError = {
  error?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        let message = "Could not send reset email";
        const payload = (await response.json().catch(() => null)) as APIError | null;
        if (payload?.error) {
          message = payload.error;
        }
        setError(message);
        return;
      }

      setSubmitted(true);
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
        <h1 className="text-2xl font-semibold text-zinc-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Enter your email and we will send you a link to reset your password.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            If an account exists for this email, a password reset link has been sent.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 transition focus:border-zinc-500"
            placeholder="you@example.com"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Sending..." : "Send Reset Link"}
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
