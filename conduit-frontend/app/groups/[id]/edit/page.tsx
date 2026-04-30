"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import appAPIClient from "@/lib/api/httpClient";
import GroupForm from "@/components/GroupForm";
import { Button } from "@/components/button";

interface Group {
  id: string;
  name: string;
  role?: string;
  is_open?: boolean;
}

export default function EditGroupPage() {
  const params = useParams() as { id: string };
  const id = params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    appAPIClient
      .get(`/groups/${id}`)
      .then((res) => {
        if (mounted) {
          setGroup(res.data);
          if (res.data.role !== "admin") {
            setError("You do not have permission to edit this group");
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

  if (loading) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-center justify-center px-5 py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink/20 border-t-ink"></div>
        <p className="mt-4 text-sm font-medium text-ink/40">Opening settings...</p>
      </main>
    );
  }

  if (error || !group || group.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl px-5 py-24">
        <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-12 text-center backdrop-blur-sm">
          <h2 className="text-xl font-bold text-rose-900">Access Denied</h2>
          <p className="mt-2 text-rose-700/60">{error || "Group not found or no permission."}</p>
          <div className="mt-8">
            <Button href={`/groups/${id}`} variant="secondary">Back to Group</Button>
          </div>
        </div>
      </main>
    );
  }

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
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest/60">Settings</p>
            <h1 className="mt-3 font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
              Edit Group.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
              Refine the group identity or adjust the privacy settings. Changes reflect immediately for all members.
            </p>
          </div>
          <Button href={`/groups/${id}`} variant="nav-secondary" size="sm">
            Cancel Changes
          </Button>
        </div>

        <div className="float-in delay-1">
          <div className="glass-card rounded-[2.5rem] border border-ink/10 p-8 shadow-glow sm:p-10">
            <GroupForm
              mode="edit"
              groupId={id}
              initialData={{
                name: group.name,
                privacy: group.is_open ? "public" : "private",
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
