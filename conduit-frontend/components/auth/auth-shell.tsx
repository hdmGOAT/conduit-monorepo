import Link from "next/link";
import { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  exitHref?: string;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  exitHref = "/",
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_18%,rgba(255,177,42,.16),transparent_30%),radial-gradient(circle_at_88%_78%,rgba(239,109,76,.16),transparent_32%),linear-gradient(145deg,#f8f7f2,#dff1ec_55%,#ffd9b8)] px-4 py-6 text-[#122038] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(18,32,56,.04)_1px,transparent_1px)] bg-size-[3px_3px] opacity-25" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center py-10">
        <section className="flex w-full justify-center">
          <div className="relative w-full max-w-md rounded-4xl border border-[#122038]/10 bg-[#f8f7f2]/80 p-7 shadow-[0_0_0_1px_rgba(18,32,56,.08),0_30px_80px_rgba(18,32,56,.18)] backdrop-blur-xl sm:p-10">
            <Link
              href={exitHref}
              className="absolute right-7 top-7 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#122038]/10 bg-white text-[#122038]/70 transition hover:border-[#122038]/20 hover:text-[#122038] hover:bg-[#f0f0f0] sm:right-10 sm:top-10"
              title="Exit"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>

            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#122038]/50">
                {eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#122038]/70">
                {description}
              </p>
            </div>

            {children}

            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}