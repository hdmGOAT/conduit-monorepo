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
        // create with name and is_open
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-[#122038]">
          Group name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-2xl border border-[#122038]/12 bg-white px-4 py-3 text-[#122038] shadow-sm outline-none transition placeholder:text-[#122038]/35 focus:border-[#122038]/30 focus:ring-2 focus:ring-[#122038]/10"
          placeholder="Weekend Book Club"
          required
          minLength={3}
        />
        <p className="text-sm text-[#122038]/60">
          A short, legible name makes the group easier to find later.
        </p>
        {fieldErrors.name ? (
          <p className="text-sm font-medium text-rose-600">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-semibold text-[#122038]">
            Privacy
          </label>
          <p className="mt-1 text-sm text-[#122038]/60">
            This controls whether access is instant or review-based.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {privacyOptions.map((option) => {
            const selected = privacy === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPrivacy(option.value)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#122038]/20 ${
                  selected
                    ? "border-[#122038] bg-[#122038] text-[#f8f7f2] shadow-[0_12px_28px_rgba(18,32,56,0.18)]"
                    : "border-[#122038]/12 bg-white text-[#122038] hover:border-[#122038]/30 hover:bg-[#f8f7f2]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.14em]">
                      {option.title}
                    </div>
                    <div
                      className={`mt-2 text-sm leading-6 ${selected ? "text-[#f8f7f2]/80" : "text-[#122038]/65"}`}
                    >
                      {option.description}
                    </div>
                  </div>
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      selected
                        ? "border-[#f8f7f2] bg-[#f8f7f2]"
                        : "border-[#122038]/20 bg-white"
                    }`}
                    aria-hidden="true"
                  >
                    {selected ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#122038]" />
                    ) : null}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {fieldErrors.privacy ? (
          <p className="text-sm font-medium text-rose-600">
            {fieldErrors.privacy}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto"
        >
          {submitting
            ? mode === "edit"
              ? "Saving…"
              : "Creating…"
            : mode === "edit"
              ? "Save changes"
              : "Create group"}
        </Button>
        <p className="text-sm text-[#122038]/60">
          {mode === "edit"
            ? "Changes update the group name first, then its access mode."
            : "You can adjust privacy later if the group grows."}
        </p>
      </div>
    </form>
  );
}
