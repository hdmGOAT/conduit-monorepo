"use client";

import React, { useEffect, useState } from "react";
import { Button } from "./button";
import appAPIClient from "@/lib/api/httpClient";
import { groupFormSchema } from "@/lib/validators/groups";

type Privacy = "public" | "private";

interface Group {
  id?: string;
  name?: string;
  privacy?: Privacy;
}

interface GroupFormProps {
  initialData?: Partial<Group>;
  onSuccess?: (group: Group) => void;
  mode?: "create" | "edit";
  groupId?: string;
}

export default function GroupForm({
  initialData,
  onSuccess,
  mode = "create",
  groupId,
}: GroupFormProps) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setName(initialData.name ?? "");
      setPrivacy((initialData.privacy as Privacy) ?? "public");
    }
  }, [initialData]);

  const privacyOptions: Array<{
    value: Privacy;
    title: string;
    description: string;
  }> = [
    {
      value: "public",
      title: "Public",
      description: "Anyone with the join code can enter immediately.",
    },
    {
      value: "private",
      title: "Private",
      description: "Join requests wait for admin approval.",
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = groupFormSchema.safeParse({
      name,
      privacy,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        if (messages?.[0]) {
          errors[field] = messages[0];
        }
      });
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      if (mode === "edit" && groupId) {
        const body = { name: name.trim() };
        const res = await appAPIClient.patch(`/groups/${groupId}`, body);

        // Also update privacy setting
        const privacyBody = { is_open: privacy === "public" };
        await appAPIClient.patch(`/groups/${groupId}/is_open`, privacyBody);

        const updated = res.data;
        onSuccess?.(updated);
        window.location.href = `/groups/${updated.id ?? groupId}`;
      } else {
        const body = {
          name: name.trim(),
          is_open: privacy === "public",
        };
        const res = await appAPIClient.post("/groups", body);
        const created = res.data;
        onSuccess?.(created);
        if (created?.id) {
          window.location.href = `/groups/${created.id}`;
        } else {
          window.location.reload();
        }
      }
    } catch (err: unknown) {
      const apiError = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      setError(
        apiError?.response?.data?.error ||
          apiError?.message ||
          "An error occurred",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-3">
        <label className="text-sm font-bold uppercase tracking-widest text-ink/30 ml-1">
          Group Identity
        </label>
        <div className="relative">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-2xl border border-ink/10 bg-white/50 px-5 py-4 text-lg font-bold text-ink outline-none transition focus:border-ink/20 focus:ring-4 focus:ring-ink/5 placeholder:text-ink/20"
            placeholder="e.g. Weekend Book Club"
            required
            minLength={3}
          />
        </div>
        <p className="px-1 text-xs font-medium text-ink/40">
          A clear, memorable name helps members identify your space quickly.
        </p>
        {fieldErrors.name && (
          <p className="px-1 text-xs font-bold text-ember">{fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-4">
        <label className="text-sm font-bold uppercase tracking-widest text-ink/30 ml-1">
          Privacy Mode
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {privacyOptions.map((option) => {
            const selected = privacy === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPrivacy(option.value)}
                className={`group relative flex flex-col rounded-3xl border p-6 text-left transition-all ${
                  selected
                    ? "border-ink bg-ink text-cloud shadow-glow"
                    : "border-ink/10 bg-white/50 text-ink hover:border-ink/20 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${selected ? "text-forest" : "text-ink/30"}`}>
                    {option.title}
                  </span>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selected ? "border-forest bg-forest" : "border-ink/10"
                  }`}>
                    {selected && <div className="h-1.5 w-1.5 rounded-full bg-ink"></div>}
                  </div>
                </div>
                <p className={`mt-3 font-bold ${selected ? "text-white" : "text-ink"}`}>
                  {option.value === 'public' ? 'Open Access' : 'Private Space'}
                </p>
                <p className={`mt-1 text-xs leading-relaxed ${selected ? "text-cloud/50" : "text-ink/40"}`}>
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
        {fieldErrors.privacy && (
          <p className="px-1 text-xs font-bold text-ember">{fieldErrors.privacy}</p>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-sm font-medium text-rose-800 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium leading-relaxed text-ink/40 italic max-w-sm">
            {mode === "edit"
              ? "Updating your group's profile will reflect instantly for all current members and pending requests."
              : "You can change these settings later as your community grows and evolves."}
          </p>
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="min-w-[200px]"
          variant="primary"
          size="md"
        >
          {submitting
            ? (mode === "edit" ? "Saving..." : "Creating...")
            : (mode === "edit" ? "Save Changes" : "Launch Group")}
        </Button>
      </div>
    </form>
  );
}
