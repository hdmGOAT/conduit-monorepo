"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Fraunces, Space_Grotesk } from "next/font/google";
import appAPIClient from "@/lib/api/httpClient";
import GroupForm from "@/components/GroupForm";

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
      <main
        className={`${space.className} min-h-screen px-6 py-8 text-[#122038]`}
      >
        Loading...
      </main>
    );
  }

  if (error || !group || group.role !== "admin") {
    return (
      <main
        className={`${space.className} min-h-screen px-6 py-8 text-[#122038]`}
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 mb-4">
          {error || "Group not found or no permission."}
        </div>
        <Link
          href={`/groups/${id}`}
          className="text-[#122038] underline-offset-4 hover:underline"
        >
          Back to group
        </Link>
      </main>
    );
  }

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
              Edit group
            </p>
            <h1
              className={`${fraunces.className} mt-4 text-4xl leading-[1.02] sm:text-5xl`}
            >
              Refine the group without changing its shape.
            </h1>
          </div>
          <Link
            href={`/groups/${id}`}
            className="text-sm font-semibold text-[#122038] underline-offset-4 hover:underline"
          >
            Cancel
          </Link>
        </div>

        <div className="stitch-panel rounded-[2rem] border border-[#122038]/10 p-6 shadow-glow sm:p-8">
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
    </main>
  );
}
