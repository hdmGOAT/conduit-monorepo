import { Fraunces, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Button } from "@/components/button";

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
          "radial-gradient(circle at 12% 18%, rgba(255, 177, 42, 0.18), transparent 30%), radial-gradient(circle at 88% 78%, rgba(239, 109, 76, 0.18), transparent 32%), linear-gradient(145deg, #f8f7f2, #dff1ec 55%, #ffd9b8)",
      }}
    >
      <div className="noise" />

      <div className="relative z-10">
        <header className="sticky top-0 z-30 border-b border-ink/10 bg-cloud/95 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <Link
              href="/"
              className={`${fraunces.className} text-3xl font-semibold tracking-tight`}
            >
              Conduit
            </Link>
            <div className="flex items-center gap-3">
              <Button
                href="/login"
                variant="nav-primary"
                size="sm"
              >
                Log In
              </Button>
              <Button
                href="/signup"
                variant="nav-secondary"
                size="sm"
              >
              Sign Up
              </Button>
            </div>
          </nav>
        </header>

        <div>
          <section className="relative overflow-hidden">
            <div className="hero-ring absolute -right-30 top-20 hidden lg:block" />
            <div className="mx-auto max-w-6xl px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-24">
              <div className="grid items-center gap-10 lg:grid-cols-2">
                <div>
                  <p className="float-in inline-flex items-center gap-2 rounded-full border border-ink/10 bg-ink/5 px-4 py-2 text-sm font-medium uppercase tracking-[0.14em]">
                    Made for community
                  </p>
                  <h1
                    className={`${fraunces.className} float-in delay-1 mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl`}
                  >
                    Manage your
                    <span className="text-forest"> payments </span>
                    without the stress.
                  </h1>
                  <p className="float-in delay-2 mt-6 max-w-xl text-xl leading-relaxed text-ink/80">
                    Conduit is an all-in-one community workspace that brings
                    members, organizers, and tools together in one place. Create
                    forms, share updates, and keep operations in sync.
                  </p>
                  <div className="float-in delay-3 mt-9 flex flex-col gap-4 sm:flex-row">
                    <Button
                      href="/signup"
                      variant="primary"
                      size="md"
                    >
                      Start My Group
                    </Button>
                    <Button
                      href="/login"
                      variant="secondary"
                      size="md"
                    >
                      Log In
                    </Button>
                  </div>
                  <div className="mt-10 flex items-center gap-6 text-base text-ink/75">
                    <p>
                      <span className="font-medium text-ink">4.9/5</span> user
                      rating
                    </p>
                    <p>
                      <span className="font-medium text-ink">1,000+</span>{" "}
                      groups organized
                    </p>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="glass-card rounded-3xl border border-ink/10 p-5 shadow-glow sm:p-7">
                    <div className="rounded-2xl bg-ink p-6 text-cloud">
                      <p className="text-2xl font-medium uppercase tracking-[0.18em] text-cloud/90">
                        Dashboard
                      </p>
                      <div className="mt-5 grid gap-4">
                        <div className="rounded-xl bg-cloud/10 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-lg font-medium text-cloud">
                              Org T-shirt payment
                            </p>
                            <p className="text-base font-medium text-mist">
                              78% complete
                            </p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cloud/15">
                            <div className="h-full w-[78%] rounded-full bg-gold" />
                          </div>
                          <p className="mt-2 text-base leading-7 text-cloud/85">
                            22% more needed to complete the payment.
                          </p>
                        </div>
                        <div className="rounded-xl bg-cloud/10 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-lg font-medium text-cloud">
                              Dinner with Friends
                            </p>
                            <p className="text-base font-medium text-mist">
                              54% complete
                            </p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-cloud/15">
                            <div className="h-full w-[54%] rounded-full bg-ember" />
                          </div>
                          <p className="mt-2 text-base leading-7 text-cloud/85">
                            46% more needed before the bill is fully covered.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <article className="rounded-2xl border border-ink/10 bg-cloud p-4">
                        <p className="text-base font-medium uppercase tracking-[0.14em] text-ink">
                          Contributions
                        </p>
                        <p className="mt-2 text-xl leading-8 font-normal text-ink/85">
                          Track who has paid and who is still pending
                        </p>
                      </article>
                      <article className="rounded-2xl border border-ink/10 bg-cloud p-4">
                        <p className="text-base font-medium uppercase tracking-[0.14em] text-ink">
                          Reminders
                        </p>
                        <p className="mt-2 text-xl leading-8 font-normal text-ink/85">
                          Send friendly prompts before the deadline
                        </p>
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
            <div className="rounded-4xl border border-ink/10 bg-[#eef1ec] p-8 text-center shadow-[0_20px_60px_rgba(18,32,56,0.08)] sm:p-10">
              <h2
                className={`${fraunces.className} text-4xl leading-tight sm:text-5xl`}
              >
                Your members are waiting.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-ink/75">
                Build your community in minutes. Invite your first peers and
                handle your payments all in one place.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Button
                  href="/signup"
                  variant="tertiary"
                  size="lg"
                >
                  Create An Account
                </Button>
              </div>
            </div>
          </section>
        </div>

        <footer className="border-t border-ink/10">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 py-10 text-xl font-semibold sm:flex-row sm:px-8">
            <p>Conduit, 2026.</p>
            <div className="flex gap-5 text-ink/70">
              <a href="#" className="transition-colors hover:text-ink">
                Terms
              </a>
              <a href="#" className="transition-colors hover:text-ink">
                Privacy
              </a>
              <a href="#" className="transition-colors hover:text-ink">
                Status
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
