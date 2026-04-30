"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import appAPIClient from "@/lib/api/httpClient";

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
      className="relative min-h-screen overflow-x-clip px-5 py-12 sm:px-8"
      style={{
        background:
          "radial-gradient(circle at 10% 16%, rgba(255, 177, 42, 0.16), transparent 28%), radial-gradient(circle at 90% 84%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #e7f0ec 56%, #f7d9bb)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-16 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">Groups Studio</p>
            <h1 className="mt-4 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Govern your spaces.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
              A single, unified dashboard for your managed communities, memberships, and review queues.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:min-w-[400px]">
            {[
              { label: 'Total', count: totalGroups },
              { label: 'Managed', count: ownedGroups.length },
              { label: 'Pending', count: joinRequests.length },
            ].map((stat) => (
              <div key={stat.label} className="glass-card flex flex-col items-center justify-center rounded-2xl border border-ink/5 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{stat.count}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="stitch-panel mb-16 rounded-[2.5rem] border border-ink/10 bg-ink p-8 text-cloud shadow-glow sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-bold">Join with code.</h2>
              <p className="mt-2 text-cloud/60">
                Jump into a group instantly if you have an access code from an admin.
              </p>
            </div>
            
            <form onSubmit={handleJoinWithCode} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-md">
              <div className="flex-1">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter code..."
                  className="w-full rounded-2xl border border-cloud/10 bg-cloud/5 px-4 py-3 text-cloud placeholder:text-cloud/30 outline-none transition focus:border-cloud/30 focus:ring-4 focus:ring-cloud/5"
                  required
                />
                {joinError && <p className="mt-2 text-xs font-medium text-ember">{joinError}</p>}
              </div>
              <Button type="submit" variant="primary" disabled={joinSubmitting || !joinCode.trim()}>
                {joinSubmitting ? "Joining..." : "Join"}
              </Button>
            </form>
          </div>
        </section>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-6 border-b border-ink/5 pb-4">
          <nav className="flex gap-1 rounded-full bg-ink/5 p-1.5 backdrop-blur-sm">
            {[
              { id: 'managed', label: 'Managed', count: ownedGroups.length },
              { id: 'joined', label: 'Joined', count: joinedGroups.length },
              { id: 'requests', label: 'Requests', count: joinRequests.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'managed' | 'joined' | 'requests')}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? "bg-ink text-white shadow-md" 
                    : "text-ink/40 hover:bg-ink/10 hover:text-ink/60"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === tab.id ? "bg-white/10 text-white/40" : "bg-ink/5 text-ink/20"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>

          <Button href="/groups/new" variant="nav-secondary" size="sm">
            Create New Group
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
            <p className="mt-4 text-sm font-medium text-ink/40">Loading your spaces...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-12 text-center backdrop-blur-sm">
            <p className="text-sm font-bold text-rose-800">{error}</p>
          </div>
        ) : (
          <div className="float-in grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeTab === 'managed' && (
              ownedGroups.length === 0 ? (
                <div className="col-span-full rounded-[2.5rem] border border-dashed border-ink/10 py-24 text-center">
                  <p className="text-lg font-bold text-ink/40">No managed groups yet.</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink/30">
                    Create your first community to start governing.
                  </p>
                </div>
              ) : (
                ownedGroups.map((group, i) => (
                  <LinkCard key={group.id} group={group} type="Managed" index={i} />
                ))
              )
            )}

            {activeTab === 'joined' && (
              joinedGroups.length === 0 ? (
                <div className="col-span-full rounded-[2.5rem] border border-dashed border-ink/10 py-24 text-center">
                  <p className="text-lg font-bold text-ink/40">No joined groups yet.</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink/30">
                    Join a community using a code to see it here.
                  </p>
                </div>
              ) : (
                joinedGroups.map((group, i) => (
                  <LinkCard key={group.id} group={group} type="Joined" index={i} />
                ))
              )
            )}

            {activeTab === 'requests' && (
              joinRequests.length === 0 ? (
                <div className="col-span-full rounded-[2.5rem] border border-dashed border-ink/10 py-24 text-center">
                  <p className="text-lg font-bold text-ink/40">No pending requests.</p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-ink/30">
                    New member requests will appear here for your review.
                  </p>
                </div>
              ) : (
                joinRequests.map((request, i) => (
                  <LinkCard 
                    key={request.group_id} 
                    group={{ id: request.group_id, name: request.group_name || 'Unnamed Group' }} 
                    type="Pending" 
                    index={i} 
                  />
                ))
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function LinkCard({ group, type, index }: { group: Group, type: string, index: number }) {
  const isPending = type === 'Pending'
  const isManaged = type === 'Managed'

  return (
    <a
      href={`/groups/${group.id}`}
      className="glass-card group flex flex-col rounded-[2rem] border border-ink/10 p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-ink/20 hover:shadow-glow"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            isPending ? "text-ember" : isManaged ? "text-forest" : "text-gold"
          }`}>
            {type}
          </span>
          <h3 className="mt-1 font-display text-2xl font-bold text-ink group-hover:text-ink/80 transition-colors">
            {group.name}
          </h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 text-ink transition-all group-hover:bg-ink group-hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      <p className="mt-auto text-sm leading-relaxed text-ink/50">
        {isManaged 
          ? "Full administrative control over members, billing, and settings." 
          : isPending 
          ? "Waiting for approval from the community administrators." 
          : "View activity, participate in collections, and engage."}
      </p>
    </a>
  )
}
