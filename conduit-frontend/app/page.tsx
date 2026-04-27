import { Fraunces, Space_Grotesk } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function Home() {
  return (
    <main
      className={`${space.className} relative min-h-screen overflow-x-clip text-[#122038]`}
      style={{
        background:
          "radial-gradient(circle at 12% 18%, rgba(255,177,42,.18), transparent 30%), radial-gradient(circle at 88% 78%, rgba(239,109,76,.18), transparent 32%), linear-gradient(145deg, #f8f7f2, #dff1ec 55%, #ffd9b8)",
      }}
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(rgba(18,32,56,.04)_1px,transparent_1px)] bg-size-[3px_3px] opacity-30" />

      <div className="relative z-10">
        <header className="sticky top-0 z-20 border-b border-[#122038]/10 bg-[#f8f7f2]/70 backdrop-blur-xl">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <a
              href="#"
              className={`${fraunces.className} text-3xl font-semibold tracking-tight`}
            >
              Conduit
            </a>
            <div className="hidden items-center gap-8 text-sm font-semibold md:flex">
              <a
                href="#features"
                className="transition-colors hover:text-[#0f6f61]"
              >
                Features
              </a>
              <a
                href="#proof"
                className="transition-colors hover:text-[#0f6f61]"
              >
                Proof
              </a>
              <a
                href="#pricing"
                className="transition-colors hover:text-[#0f6f61]"
              >
                Pricing
              </a>
            </div>
            <button className="rounded-full bg-[#122038] px-5 py-2.5 text-sm font-semibold text-[#f8f7f2] transition-colors hover:bg-[#0f6f61]">
              Start Free
            </button>
          </nav>
        </header>

        <section className="relative overflow-hidden">
          <div className="hero-ring absolute right-[-120px] top-[80px] hidden lg:block" />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-2 lg:pb-28 lg:pt-24">
            <div>
              <p className="float-in inline-flex items-center gap-2 rounded-full border border-[#122038]/10 bg-[#122038]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]">
                Built for paid communities
              </p>
              <h1
                className={`${fraunces.className} float-in delay-1 mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl`}
              >
                Run your community{" "}
                <span className="text-[#0f6f61]">like a product</span>, and grow
                like media.
              </h1>
              <p className="float-in delay-2 mt-6 max-w-xl text-lg leading-relaxed text-[#122038]/80">
                Conduit gives creators one place for memberships, gated content,
                payments, and member analytics. Stop duct-taping tools and start
                shipping experiences.
              </p>
              <div className="float-in delay-3 mt-9 flex flex-col gap-4 sm:flex-row">
                <button className="rounded-xl bg-[#122038] px-7 py-3.5 font-semibold text-[#f8f7f2] transition-all hover:-translate-y-0.5 hover:bg-[#0f6f61]">
                  Launch My Space
                </button>
                <button className="rounded-xl border border-[#122038]/15 bg-[#f8f7f2]/70 px-7 py-3.5 font-semibold transition-colors hover:bg-[#f8f7f2]">
                  See Product Tour
                </button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-[#122038]/70">
                <p>
                  <span className="font-semibold text-[#122038]">4.9/5</span>{" "}
                  user rating
                </p>
                <p>
                  <span className="font-semibold text-[#122038]">2,100+</span>{" "}
                  creators onboarded
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="glass-card rounded-3xl border border-[#122038]/10 p-5 shadow-[0_0_0_1px_rgba(18,32,56,.08),0_30px_80px_rgba(18,32,56,.18)] sm:p-7">
                <div className="rounded-2xl bg-[#122038] p-6 text-[#f8f7f2]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#f8f7f2]/70">
                    Live dashboard
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#f8f7f2]/10 p-4">
                      <p className="text-xs text-[#f8f7f2]/70">MRR</p>
                      <p className={`${fraunces.className} mt-1 text-3xl`}>
                        $18.4k
                      </p>
                      <p className="mt-2 text-xs text-[#dff1ec]">
                        +22% this month
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f8f7f2]/10 p-4">
                      <p className="text-xs text-[#f8f7f2]/70">Retention</p>
                      <p className={`${fraunces.className} mt-1 text-3xl`}>
                        94%
                      </p>
                      <p className="mt-2 text-xs text-[#dff1ec]">up from 88%</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <article className="rounded-2xl border border-[#122038]/10 bg-[#f8f7f2] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#122038]/60">
                      Automations
                    </p>
                    <p className="mt-2 text-base font-semibold">
                      Smart welcome flows
                    </p>
                  </article>
                  <article className="rounded-2xl border border-[#122038]/10 bg-[#f8f7f2] p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#122038]/60">
                      Payments
                    </p>
                    <p className="mt-2 text-base font-semibold">
                      Secure global checkout
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="proof"
          className="overflow-hidden border-y border-[#122038]/10 bg-[#f8f7f2]/70 py-5"
        >
          <div className="ticker-track flex w-max gap-12 text-sm font-semibold uppercase tracking-[0.16em] text-[#122038]/60">
            <span>Trusted by creator schools</span>
            <span>Used by premium communities</span>
            <span>Built for recurring revenue</span>
            <span>Integrated with Stripe</span>
            <span>Role-based access included</span>
            <span>Trusted by creator schools</span>
            <span>Used by premium communities</span>
            <span>Built for recurring revenue</span>
            <span>Integrated with Stripe</span>
            <span>Role-based access included</span>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-24"
        >
          <div className="max-w-2xl">
            <h2
              className={`${fraunces.className} text-4xl leading-tight sm:text-5xl`}
            >
              Everything you need to run a paid community without the chaos.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-3xl border border-[#122038]/10 bg-[#f8f7f2]/70 p-6 transition-transform hover:-translate-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f6f61]">
                Monetization
              </p>
              <h3 className={`${fraunces.className} mt-3 text-3xl`}>
                Flexible plans
              </h3>
              <p className="mt-3 text-[#122038]/75">
                Offer monthly, annual, and one-time tiers with promo support and
                automatic receipts.
              </p>
            </article>

            <article className="rounded-3xl border border-[#122038]/10 bg-[#f8f7f2]/70 p-6 transition-transform hover:-translate-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f6f61]">
                Control
              </p>
              <h3 className={`${fraunces.className} mt-3 text-3xl`}>
                Fine-grained access
              </h3>
              <p className="mt-3 text-[#122038]/75">
                Grant content access by role, plan, or collection. Keep your
                best work exclusive.
              </p>
            </article>

            <article className="rounded-3xl border border-[#122038]/10 bg-[#f8f7f2]/70 p-6 transition-transform hover:-translate-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f6f61]">
                Insights
              </p>
              <h3 className={`${fraunces.className} mt-3 text-3xl`}>
                Actionable analytics
              </h3>
              <p className="mt-3 text-[#122038]/75">
                Track churn signals, conversion cohorts, and plan upgrades in
                one clean dashboard.
              </p>
            </article>
          </div>
        </section>

        <section id="pricing" className="px-5 pb-20 sm:px-8 lg:pb-28">
          <div className="mx-auto w-full max-w-6xl rounded-[2rem] border border-[#122038]/10 bg-[#122038] p-7 text-[#f8f7f2] sm:p-10 lg:p-12">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-[#f8f7f2]/70">
                  Pricing
                </p>
                <h2
                  className={`${fraunces.className} mt-3 text-4xl sm:text-5xl`}
                >
                  Start free. Scale when your members do.
                </h2>
                <p className="mt-4 max-w-2xl text-[#f8f7f2]/80">
                  No setup fee. No weird add-ons. Just transparent pricing
                  designed for community operators.
                </p>
              </div>
              <div className="rounded-3xl bg-[#f8f7f2] p-6 text-[#122038]">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#122038]/70">
                  Creator
                </p>
                <p className={`${fraunces.className} mt-2 text-5xl`}>$0</p>
                <p className="mt-1 text-sm text-[#122038]/70">per month</p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li>Up to 100 members</li>
                  <li>Basic analytics</li>
                  <li>Email support</li>
                </ul>
                <button className="mt-6 w-full rounded-xl bg-[#122038] py-3 font-semibold text-[#f8f7f2] transition-colors hover:bg-[#0f6f61]">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="rounded-[2rem] border border-[#122038]/10 bg-[#f8f7f2]/70 p-8 text-center sm:p-10">
            <h2
              className={`${fraunces.className} text-4xl leading-tight sm:text-5xl`}
            >
              Your members are waiting.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-[#122038]/75">
              Build your premium community in days, not months. Invite your
              first cohort and run everything from one command center.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <button className="rounded-xl bg-[#ef6d4c] px-7 py-3.5 font-semibold text-white transition-all hover:brightness-95">
                Create My Conduit
              </button>
              <button className="rounded-xl border border-[#122038]/20 px-7 py-3.5 font-semibold transition-colors hover:bg-[#f8f7f2]">
                Book a Demo
              </button>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#122038]/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-4 px-5 py-10 text-sm sm:flex-row sm:px-8">
            <p>Conduit, 2026.</p>
            <div className="flex gap-5 text-[#122038]/70">
              <a href="#" className="transition-colors hover:text-[#122038]">
                Terms
              </a>
              <a href="#" className="transition-colors hover:text-[#122038]">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-[#122038]">
                Status
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
