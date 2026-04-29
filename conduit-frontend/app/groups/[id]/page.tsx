"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Fraunces, Space_Grotesk } from "next/font/google";
import appAPIClient from "@/lib/api/httpClient";
import ConfirmModal from "@/components/ConfirmModal";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

interface Group {
  id: string;
  name: string;
  role?: string;
  owner_id: string;
  join_code?: string;
  has_pending_request?: boolean;
}

interface Membership {
  user_id: string;
  group_id: string;
  role: string;
  display_name?: string;
  email?: string;
}

interface JoinRequest {
  user_id: string;
  group_id: string;
  status: string;
  display_name?: string;
  email?: string;
}

export default function Page() {
  const params = useParams() as { id: string };
  const id = params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<Membership | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "members" | "requests"
  >("overview");

  const isMember = Boolean(group?.role);
  const isAdmin = group?.role === "admin";
  const memberDisplayName = memberToRemove
    ? memberToRemove.display_name ||
      memberToRemove.email ||
      `User #${memberToRemove.user_id}`
    : "";

  useEffect(() => {
    let mounted = true;
    appAPIClient
      .get(`/groups/${id}`)
      .then((res) => {
        if (mounted) {
          setGroup(res.data);
          if (res.data.role) {
            appAPIClient
              .get(`/groups/${id}/memberships`)
              .then((mRes) => {
                if (mounted) setMemberships(mRes.data);
              })
              .catch(console.error);
          }
          if (res.data.role === "admin") {
            appAPIClient
              .get(`/groups/${id}/join-requests`)
              .then((jrRes) => {
                if (mounted)
                  setJoinRequests(
                    jrRes.data.filter(
                      (jr: JoinRequest) => jr.status === "pending",
                    ),
                  );
              })
              .catch(console.error);
          }
        }
      })
      .catch((err) => {
        if (mounted)
          setError(
            err?.response?.data?.error ||
              err?.message ||
              "Failed to load group",
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  async function requestJoin() {
    if (!group) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await appAPIClient.post(`/groups/${id}/join`, {});
      const body = res.data ?? {};
      if (body.message === "already a member") {
        setMessage("You are already a member of this group.");
      } else if (
        body.status === "pending" ||
        body.message === "join request already exists" ||
        body.message === "join request created"
      ) {
        setMessage("Your join request was sent and is waiting for review.");
        setGroup({ ...group, has_pending_request: true });
      } else {
        setMessage("You joined the group.");
        setGroup({ ...group, role: body.role as string });
        appAPIClient
          .get(`/groups/${id}/memberships`)
          .then((mRes) => setMemberships(mRes.data));
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        apiError?.response?.data?.error ||
          apiError?.message ||
          "Failed to request access",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveGroup() {
    if (submitting) return;
    if (!confirm("Are you sure you want to leave this group?")) return;
    setSubmitting(true);
    setError(null);

    try {
      await appAPIClient.delete(`/groups/${id}/memberships/me`);
      window.location.href = "/groups";
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        apiError?.response?.data?.error ||
          apiError?.message ||
          "Failed to leave group",
      );
      setSubmitting(false);
    }
  }

  function requestMemberRemoval(member: Membership) {
    setRemoveError(null);
    setMemberToRemove(member);
  }

  function cancelMemberRemoval() {
    if (removeSubmitting) return;
    setMemberToRemove(null);
    setRemoveError(null);
  }

  async function confirmMemberRemoval() {
    if (!memberToRemove) return;
    setRemoveSubmitting(true);
    setRemoveError(null);

    try {
      await appAPIClient.delete(
        `/groups/${id}/memberships/${memberToRemove.user_id}`,
      );
      setMemberships((prev) =>
        prev.filter((m) => m.user_id !== memberToRemove.user_id),
      );
      setMemberToRemove(null);
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setRemoveError(
        apiError?.response?.data?.error ||
          apiError?.message ||
          "Failed to remove member",
      );
    } finally {
      setRemoveSubmitting(false);
    }
  }

  async function handleJoinRequest(
    userId: string,
    action: "approved" | "denied",
  ) {
    try {
      await appAPIClient.patch(`/groups/${id}/join-requests/${userId}`, {
        status: action,
        role: "member",
      });
      setJoinRequests(joinRequests.filter((jr) => jr.user_id !== userId));
      if (action === "approved") {
        // Refresh memberships to include the new member
        appAPIClient
          .get(`/groups/${id}/memberships`)
          .then((mRes) => setMemberships(mRes.data));
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      alert(
        apiError?.response?.data?.error ||
          apiError?.message ||
          `Failed to ${action} request`,
      );
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        Loading...
      </main>
    );
  }

  if (!group) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          {error || "Group not found"}
        </div>
        <Link href="/groups" className="text-blue-600 underline">
          Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main
      className={`${space.className} relative min-h-screen overflow-x-clip text-[#122038]`}
      style={{
        background:
          "radial-gradient(circle at 12% 18%, rgba(255, 177, 42, 0.16), transparent 28%), radial-gradient(circle at 88% 82%, rgba(239, 109, 76, 0.14), transparent 30%), linear-gradient(145deg, #f8f7f2, #dfeee8 56%, #f9dabc)",
      }}
    >
      <div className="noise" />
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-6 sm:px-8 lg:py-8">
        <section className="stitch-panel rounded-4xl border border-[#122038]/10 p-6 shadow-glow sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#122038]/10 bg-[#122038]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
                Group detail
              </p>
              <h1
                className={`${fraunces.className} mt-5 text-4xl leading-[1.02] sm:text-5xl lg:text-6xl`}
              >
                {group.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/groups"
                className="rounded-full border border-[#122038]/14 bg-white/80 px-4 py-2 text-sm font-semibold text-[#122038]/80 transition hover:bg-[#eef1ec] hover:text-[#122038]"
              >
                Back to groups
              </Link>
              <span className="rounded-full border border-[#122038]/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[#122038]/72">
                {isMember ? `Role: ${group.role}` : "Not a member"}
              </span>
              <span className="rounded-full border border-[#122038]/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[#122038]/72">
                Members: {memberships.length}
              </span>
              {isAdmin ? (
                <span className="rounded-full border border-[#122038]/10 bg-[#122038] px-4 py-2 text-sm font-semibold text-[#f8f7f2]">
                  Admin review
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-[#122038]/10 bg-white/80 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/50">
                Access
              </p>
              <p className="mt-2 text-lg font-semibold">
                {isMember
                  ? "Joined"
                  : group.has_pending_request
                    ? "Request pending"
                    : "Join available"}
              </p>
            </article>
            <article className="rounded-3xl border border-[#122038]/10 bg-white/80 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/50">
                Queue
              </p>
              <p className="mt-2 text-lg font-semibold">
                {joinRequests.length} pending reviews
              </p>
            </article>
            <article className="rounded-3xl border border-[#122038]/10 bg-white/80 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-[#122038]/50">
                Join code
              </p>
              <p className="mt-2 text-lg font-semibold">
                {isAdmin ? group.join_code || "Not set" : "Hidden"}
              </p>
            </article>
          </div>

          <div className="mt-8 flex flex-wrap gap-2 rounded-full border border-[#122038]/10 bg-white/80 p-2 shadow-sm">
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === "overview" ? "bg-[#122038] text-[#f8f7f2]" : "text-[#122038]/70 hover:bg-[#122038]/5 hover:text-[#122038]"}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            {isMember ? (
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === "members" ? "bg-[#122038] text-[#f8f7f2]" : "text-[#122038]/70 hover:bg-[#122038]/5 hover:text-[#122038]"}`}
                onClick={() => setActiveTab("members")}
              >
                Members ({memberships.length})
              </button>
            ) : null}
            {isAdmin ? (
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === "requests" ? "bg-[#122038] text-[#f8f7f2]" : "text-[#122038]/70 hover:bg-[#122038]/5 hover:text-[#122038]"}`}
                onClick={() => setActiveTab("requests")}
              >
                Pending Requests{" "}
                {joinRequests.length > 0 ? `(${joinRequests.length})` : ""}
              </button>
            ) : null}
          </div>

          {activeTab === "overview" ? (
            <section className="mt-8">
              <div className="rounded-[1.75rem] border border-[#122038]/10 bg-white/85 p-6 shadow-sm sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#122038]/50">
                  Access state
                </p>
                {isMember ? (
                  <div className="mt-4 space-y-4">
                    <p className="text-base leading-7 text-[#122038]/72">
                      You are already inside this group as{" "}
                      <span className="font-semibold text-[#122038]">
                        {group.role}
                      </span>
                      .
                    </p>
                    {isAdmin ? (
                      <div className="rounded-3xl border border-[#122038]/10 bg-[#122038] p-5 text-[#f8f7f2]">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f8f7f2]/60">
                              Join code
                            </p>
                            <p className="mt-2 text-2xl font-semibold tracking-[0.2em]">
                              {group.join_code || "None"}
                            </p>
                          </div>
                          <div className="rounded-full border border-[#f8f7f2]/20 bg-[#f8f7f2]/10 px-3 py-1 text-xs font-semibold">
                            Share manually
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-[#122038]/10 bg-[#eef1ec] p-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#122038]/50">
                          Member action
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#122038]/68">
                          Leave this group if you no longer need access.
                        </p>
                        <button
                          type="button"
                          onClick={leaveGroup}
                          disabled={submitting}
                          className="mt-4 rounded-2xl bg-[#ffd7d0] px-4 py-3 text-sm font-semibold text-[#122038] transition hover:bg-[#ffc8bf] disabled:opacity-60"
                        >
                          Leave group
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-base leading-7 text-[#122038]/72">
                      Public groups add you instantly. Private groups route you
                      through a join request for owners and admins.
                    </p>
                    <div className="rounded-3xl border border-[#122038]/10 bg-[#122038] p-5 text-[#f8f7f2]">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f8f7f2]/60">
                        Join flow
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#f8f7f2]/72">
                        Keep the CTA simple, but let the supporting copy explain
                        what happens next for public and private groups.
                      </p>
                      <button
                        type="button"
                        onClick={requestJoin}
                        disabled={submitting || group.has_pending_request}
                        className="mt-4 rounded-2xl bg-[#f8f7f2] px-5 py-3 text-sm font-semibold text-[#122038] transition hover:bg-[#eef1ec] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting
                          ? "Requesting…"
                          : group.has_pending_request
                            ? "Request Pending"
                            : "Join or request access"}
                      </button>
                    </div>
                  </div>
                )}

                {message ? (
                  <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
                    {error}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-4">
                  <Link
                    href="/groups"
                    className="text-sm font-semibold text-[#122038] underline-offset-4 hover:underline"
                  >
                    Back to groups
                  </Link>
                  {isAdmin ? (
                    <Link
                      href={`/groups/${id}/edit`}
                      className="text-sm font-semibold text-[#122038] underline-offset-4 hover:underline"
                    >
                      Edit group
                    </Link>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "requests" && isAdmin ? (
            <section className="mt-8 rounded-[1.75rem] border border-[#122038]/10 bg-white/85 p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#122038]/50">
                    Pending join requests
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Review the queue
                  </h2>
                </div>
                <span className="rounded-full border border-[#122038]/10 bg-[#eef1ec] px-3 py-1 text-sm font-semibold text-[#122038]/70">
                  {joinRequests.length} waiting
                </span>
              </div>
              {joinRequests.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-[#122038]/14 bg-[#f8f7f2] p-8 text-center text-sm text-[#122038]/60">
                  No pending requests right now.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-[#122038]/10 overflow-hidden rounded-3xl border border-[#122038]/10 bg-[#f8f7f2]">
                  {joinRequests.map((jr) => (
                    <div
                      key={jr.user_id}
                      className="flex flex-col gap-4 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold">
                          {jr.display_name || jr.email || `User #${jr.user_id}`}
                        </div>
                        <div className="mt-1 text-sm text-[#122038]/58">
                          Requested to join
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleJoinRequest(jr.user_id, "approved")
                          }
                          className="rounded-full bg-[#122038] px-4 py-2 text-sm font-semibold text-[#f8f7f2] transition hover:bg-[#0b1f4b]"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            handleJoinRequest(jr.user_id, "denied")
                          }
                          className="rounded-full border border-[#122038]/12 bg-white px-4 py-2 text-sm font-semibold text-[#122038] transition hover:bg-[#f8f7f2]"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "members" && isMember ? (
            <section className="mt-8 rounded-[1.75rem] border border-[#122038]/10 bg-white/85 p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#122038]/50">
                    Members
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    People in this group
                  </h2>
                </div>
                <span className="rounded-full border border-[#122038]/10 bg-[#eef1ec] px-3 py-1 text-sm font-semibold text-[#122038]/70">
                  {memberships.length}
                </span>
              </div>
              <div className="mt-5 divide-y divide-[#122038]/10 overflow-hidden rounded-3xl border border-[#122038]/10 bg-[#f8f7f2]">
                {memberships.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-[#122038]/60">
                    No members to display.
                  </div>
                ) : (
                  memberships.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex flex-col gap-4 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="font-semibold">
                          {m.display_name || m.email || `User #${m.user_id}`}
                        </div>
                        <div className="mt-1 text-sm capitalize text-[#122038]/58">
                          {m.role}
                        </div>
                      </div>
                      {isAdmin && m.user_id !== group.owner_id ? (
                        <button
                          onClick={() => requestMemberRemoval(m)}
                          className="rounded-full border border-[#122038]/12 bg-white px-4 py-2 text-sm font-semibold text-[#122038] transition hover:bg-[#f8f7f2]"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(memberToRemove)}
        eyebrow="Remove member"
        title={memberToRemove ? `Remove ${memberDisplayName}?` : ""}
        description="This member will lose access to the group immediately."
        confirmLabel="Remove member"
        isSubmitting={removeSubmitting}
        errorMessage={removeError}
        onCancel={cancelMemberRemoval}
        onConfirm={confirmMemberRemoval}
      />
    </main>
  );
}
