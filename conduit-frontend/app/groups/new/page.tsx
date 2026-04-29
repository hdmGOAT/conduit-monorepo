import GroupForm from "../../../components/GroupForm";
import Link from "next/link";
import { Fraunces, Space_Grotesk } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Create Group",
};

export default function Page() {
  return (
    <main
      className={`${space.className} relative min-h-screen overflow-x-clip text-[#122038]`}
      style={{
        background:
          "radial-gradient(circle at 14% 16%, rgba(255, 177, 42, 0.16), transparent 26%), radial-gradient(circle at 86% 84%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #dfeee8 56%, #f7d9bb)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-4xl px-5 py-6 sm:px-8 lg:py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#122038]/10 bg-[#122038]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
              Create group
            </p>
            <h1
              className={`${fraunces.className} mt-4 text-4xl leading-[1.02] sm:text-5xl`}
            >
              Start with a clear identity.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#122038]/70">
              The form is where the system becomes real. Keep this screen
              focused, tactile, and obvious about the privacy choice.
            </p>
          </div>
          <Link
            href="/groups"
            className="hidden text-sm font-semibold text-[#122038] underline-offset-4 hover:underline sm:block"
          >
            Back to groups
          </Link>
        </div>

        <section className="stitch-panel rounded-[2rem] border border-[#122038]/10 p-6 shadow-glow sm:p-8">
          <GroupForm />
        </section>
      </div>
    </main>
  );
}
