import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-200 px-4 py-20">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-10 text-zinc-900 shadow-xl shadow-zinc-300/40">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Conduit</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Auth Recovery</h1>
        <p className="mt-3 max-w-xl text-zinc-600">
          Password recovery is now wired into the backend and email pipeline.
          Use the links below to test the full flow.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/forgot-password"
            className="rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-zinc-700"
          >
            Forgot password
          </Link>
          <Link
            href="/reset-password"
            className="rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-900"
          >
            Reset password
          </Link>
        </div>
      </div>
    </main>
  );
}
