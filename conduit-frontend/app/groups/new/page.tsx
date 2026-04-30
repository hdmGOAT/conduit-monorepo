import GroupForm from "../../../components/GroupForm";
import { Button } from "@/components/button";

export const metadata = {
  title: "Create Group | Conduit",
};

export default function Page() {
  return (
    <main
      className="relative min-h-screen overflow-x-clip px-5 py-16 sm:px-8"
      style={{
        background:
          "radial-gradient(circle at 14% 16%, rgba(255, 177, 42, 0.16), transparent 26%), radial-gradient(circle at 86% 84%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #dfeee8 56%, #f7d9bb)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">New Community</p>
          <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
            Start with a clear identity.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
            Define your group&apos;s name and choose between a public or private space. Keep it focused and obvious.
          </p>
        </div>

        <div className="float-in delay-1">
          <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
            <GroupForm />
            
            <div className="mt-10 flex justify-center border-t border-ink/5 pt-8">
              <Button href="/groups" variant="nav-secondary" size="sm">
                Back to all groups
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
