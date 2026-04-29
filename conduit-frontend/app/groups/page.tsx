"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";
import appAPIClient from "@/lib/api/httpClient";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type Group = {
  id: string;
  name: string;
};

interface JoinRequest {
  user_id: string;
  group_id: string;
  status: string;
  group_name?: string;
}

export default function GroupsPage() {
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"managed" | "joined" | "requests">(
    "managed",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const totalGroups = ownedGroups.length + joinedGroups.length;

  useEffect(() => {
    let mounted = true;

    async function loadGroups() {
      setLoading(true);
      setError(null);

      try {
        const [ownedRes, joinedRes, requestsRes] = await Promise.all([
          appAPIClient.get("/groups/owned"),
          appAPIClient.get("/groups/joined"),
          appAPIClient.get("/groups/requests"),
        ]);

        if (mounted) {
          setOwnedGroups(
            Array.isArray(ownedRes.data)
              ? ownedRes.data
              : (ownedRes.data.groups ?? []),
          );
          setJoinedGroups(
            Array.isArray(joinedRes.data)
              ? joinedRes.data
              : (joinedRes.data.groups ?? []),
          );
          setJoinRequests(
            Array.isArray(requestsRes.data) ? requestsRes.data : [],
          );
        }
      } catch (err: unknown) {
        const apiError = err as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        if (mounted) {
          setError(apiError?.message || "Failed to load groups");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadGroups();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleJoinWithCode(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinSubmitting(true);
    setJoinError(null);
    try {
      const res = await appAPIClient.post("/groups/join-with-code", {
        code: joinCode.trim(),
      });
      window.location.href = `/groups/${res.data.group_id}`;
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setJoinError(
        apiError?.response?.data?.error ||
          apiError?.message ||
          "Failed to join group",
      );
      setJoinSubmitting(false);
    }
  }

  return (
    <main
      className={`${space.className} relative min-h-screen overflow-x-clip text-[#122038]`}
      style={{
        background:
          "radial-gradient(circle at 10% 16%, rgba(255, 177, 42, 0.16), transparent 28%), radial-gradient(circle at 90% 84%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #e7f0ec 56%, #f7d9bb)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-8">
        <section className="stitch-panel rounded-4xl border border-[#122038]/10 p-6 shadow-glow sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#122038]/10 bg-[#122038]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
                Groups studio
              </p>
              <h1
                className={`${fraunces.className} mt-5 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl`}
              >
                Design, join, and govern your community spaces.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[#122038]/72 sm:text-lg">
                A single place for managed groups, joined groups, and review
                queues.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-md">
              <article className="rounded-2xl border border-[#122038]/10 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/55">
                  Total groups
                </p>
                <p className="mt-2 text-3xl font-semibold">{totalGroups}</p>
              </article>
              <article className="rounded-2xl border border-[#122038]/10 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/55">
                  Managed
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {ownedGroups.length}
                </p>
              </article>
              <article className="rounded-2xl border border-[#122038]/10 bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/55">
                  Pending
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {joinRequests.length}
                </p>
              </article>
            </div>
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.75rem] border border-[#122038]/10 bg-[#122038] p-6 text-[#f8f7f2] shadow-[0_18px_40px_rgba(18,32,56,0.18)] sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f8f7f2]/60">
                    Join quickly
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Enter a join code to jump into a group.
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#f8f7f2]/72">
                    This is the lightweight entry path for members who already
                    have access details from an admin.
                  </p>
                </div>
                <Link
                  href="/groups/new"
                  className="inline-flex items-center justify-center rounded-full border border-[#f8f7f2]/18 bg-[#f8f7f2] px-5 py-3 text-sm font-semibold text-[#122038] transition hover:bg-[#eef1ec]"
                >
                  New group
                </Link>
              </div>

              <form
                onSubmit={handleJoinWithCode}
                className="mt-6 flex flex-col gap-3 sm:flex-row"
              >
                <div className="flex-1">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="Paste join code"
                    className="w-full rounded-2xl border border-[#f8f7f2]/15 bg-[#f8f7f2]/8 px-4 py-3 text-[#f8f7f2] placeholder:text-[#f8f7f2]/45 outline-none transition focus:border-[#f8f7f2]/30 focus:ring-2 focus:ring-[#f8f7f2]/10"
                    required
                  />
                  {joinError ? (
                    <p className="mt-2 text-sm text-[#ffd0c5]">{joinError}</p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={joinSubmitting || !joinCode.trim()}
                  className="rounded-2xl bg-[#f8f7f2] px-5 py-3 font-semibold text-[#122038] transition hover:bg-[#eef1ec] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {joinSubmitting ? "Joining..." : "Join group"}
                </button>
              </form>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-[#122038]/10 bg-white/70 p-5 text-sm text-[#122038]/65">
              Loading groups…
            </div>
          ) : null}
          {error ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {error}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="mt-8">
              <div className="flex flex-wrap gap-2 rounded-full border border-[#122038]/10 bg-white/80 p-2 shadow-sm">
                {[
                  {
                    id: "managed",
                    label: "Managed groups",
                    count: ownedGroups.length,
                  },
                  {
                    id: "joined",
                    label: "Joined groups",
                    count: joinedGroups.length,
                  },
                  {
                    id: "requests",
                    label: "Pending requests",
                    count: joinRequests.length,
                  },
                ].map((tab) => {
                  const selected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() =>
                        setActiveTab(
                          tab.id as "managed" | "joined" | "requests",
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selected ? "bg-[#122038] text-[#f8f7f2] shadow-sm" : "text-[#122038]/70 hover:bg-[#122038]/5 hover:text-[#122038]"}`}
                    >
                      {tab.label}{" "}
                      <span className="ml-1 text-xs opacity-70">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeTab === "managed" ? (
                ownedGroups.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-[#122038]/18 bg-white/70 p-10 text-center shadow-sm">
                    <p className="text-lg font-semibold">
                      No managed groups yet.
                    </p>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-[#122038]/65">
                      Create a group and the dashboard can expand into a real
                      organizer workspace.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {ownedGroups.map((group, index) => (
                      <Link
                        key={group.id}
                        href={`/groups/${group.id}`}
                        className="group rounded-3xl border border-[#122038]/10 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,32,56,0.12)]"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#122038]/50">
                              Managed
                            </p>
                            <h2 className="mt-2 text-xl font-semibold leading-tight">
                              {group.name}
                            </h2>
                          </div>
                          <span className="rounded-full border border-[#122038]/10 bg-[#122038]/5 px-3 py-1 text-xs font-semibold text-[#122038]/70 group-hover:bg-[#122038] group-hover:text-[#f8f7f2]">
                            Open
                          </span>
                        </div>
                        <div className="mt-5 h-px w-full bg-[#122038]/10" />
                        <p className="mt-4 text-sm leading-6 text-[#122038]/64">
                          Open the admin view to handle members, requests, and
                          group settings.
                        </p>
                      </Link>
                    ))}
                  </div>
                )
              ) : null}

              {activeTab === "joined" ? (
                joinedGroups.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-[#122038]/18 bg-white/70 p-10 text-center shadow-sm">
                    <p className="text-lg font-semibold">
                      No joined groups yet.
                    </p>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-[#122038]/65">
                      Use a join code to attach yourself to a group and then
                      review the detail page.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {joinedGroups.map((group, index) => (
                      <Link
                        key={group.id}
                        href={`/groups/${group.id}`}
                        className="group rounded-3xl border border-[#122038]/10 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,32,56,0.12)]"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#122038]/50">
                              Joined
                            </p>
                            <h2 className="mt-2 text-xl font-semibold leading-tight">
                              {group.name}
                            </h2>
                          </div>
                          <span className="rounded-full border border-[#122038]/10 bg-[#eef1ec] px-3 py-1 text-xs font-semibold text-[#122038]/70">
                            Member
                          </span>
                        </div>
                        <div className="mt-5 h-px w-full bg-[#122038]/10" />
                        <p className="mt-4 text-sm leading-6 text-[#122038]/64">
                          Jump into the detail screen to manage your membership
                          or review the overview.
                        </p>
                      </Link>
                    ))}
                  </div>
                )
              ) : null}

              {activeTab === "requests" ? (
                joinRequests.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-[#122038]/18 bg-white/70 p-10 text-center shadow-sm">
                    <p className="text-lg font-semibold">
                      No pending join requests.
                    </p>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-[#122038]/65">
                      Requests will appear here when members ask to join private
                      groups.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-4 xl:grid-cols-2">
                    {joinRequests.map((request, index) => (
                      <Link
                        key={request.group_id}
                        href={`/groups/${request.group_id}`}
                        className="group rounded-3xl border border-[#122038]/10 bg-white/85 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(18,32,56,0.12)]"
                        style={{ animationDelay: `${index * 40}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#122038]/50">
                              Pending
                            </p>
                            <h2 className="mt-2 text-xl font-semibold leading-tight">
                              {request.group_name}
                            </h2>
                            <p className="mt-2 text-sm text-[#122038]/64">
                              Status: {request.status}
                            </p>
                          </div>
                          <span className="rounded-full border border-[#122038]/10 bg-[#ffd7c8] px-3 py-1 text-xs font-semibold text-[#122038]">
                            Review
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
