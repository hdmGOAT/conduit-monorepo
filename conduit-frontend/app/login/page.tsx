"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type APIError = {
  error?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let message = "Could not sign in";
        const payload = (await response
          .json()
          .catch(() => null)) as APIError | null;
        if (payload?.error) {
          message = payload.error;
        }
        setError(message);
        return;
      }

      router.push("/");
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(255,177,42,.16),transparent_30%),radial-gradient(circle_at_88%_78%,rgba(239,109,76,.16),transparent_32%),linear-gradient(145deg,#f8f7f2,#dff1ec_55%,#ffd9b8)] px-4 py-6 text-[#122038] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(18,32,56,.04)_1px,transparent_1px)] bg-size-[3px_3px] opacity-25" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center py-10">
        <section className="flex w-full justify-center">
          <div className="w-full max-w-md rounded-4xl border border-[#122038]/10 bg-[#f8f7f2]/80 p-7 shadow-[0_0_0_1px_rgba(18,32,56,.08),0_30px_80px_rgba(18,32,56,.18)] backdrop-blur-xl sm:p-10">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#122038]/50">
                Welcome
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Sign in to Conduit
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#122038]/70">
                Use your account email and password to continue.
              </p>
            </div>

            {error ? (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/55"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="curator@conduit.app"
                  className="w-full rounded-2xl border border-[#122038]/10 bg-white px-4 py-3.5 text-[#122038] outline-none transition placeholder:text-[#122038]/30 focus:border-[#122038]/25 focus:bg-white"
                />
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between">
                  <label
                    className="block text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/55"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-[#122038]/45 transition hover:text-[#122038]"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-[#122038]/10 bg-white px-4 py-3.5 text-[#122038] outline-none transition placeholder:text-[#122038]/30 focus:border-[#122038]/25 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-[#122038] px-5 py-3.5 text-sm font-semibold text-[#f8f7f2] transition-all hover:bg-[#0f6f61] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-[#122038]/70">
              <span>Have an account already? </span>
              <Link
                href="/login"
                className="font-semibold text-[#122038] underline-offset-4 hover:underline"
              >
                Login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
