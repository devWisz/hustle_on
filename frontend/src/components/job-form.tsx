"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input, Textarea } from "./ui";

export function JobForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    skills: "",
    engagement: "milestone",
    budgetMinUsd: "",
    budgetMaxUsd: "",
    isRemote: true,
    location: "",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await api<{ id: string }>("/v1/jobs", {
        body: {
          title: form.title.trim(),
          description: form.description.trim(),
          skills: form.skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
          engagement: form.engagement,
          budgetMinUsd: form.budgetMinUsd ? Number(form.budgetMinUsd) : null,
          budgetMaxUsd: form.budgetMaxUsd ? Number(form.budgetMaxUsd) : null,
          isRemote: form.isRemote,
          location: form.location.trim(),
          publish: true,
        },
      });
      router.push("/jobs");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else {
        setError("That role could not be posted.");
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-5 p-6">
        <Field label="Title" htmlFor="title" error={errors.title}>
          <Input
            id="title"
            required
            maxLength={120}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Rust storage engine consultant"
          />
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          hint="The work, the deliverables, and how you will judge them."
          error={errors.description}
        >
          <Textarea
            id="description"
            rows={8}
            required
            maxLength={10000}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <Field label="Skills" htmlFor="skills" hint="Comma separated." error={errors.skills}>
          <Input
            id="skills"
            value={form.skills}
            onChange={(event) => setForm({ ...form, skills: event.target.value })}
            placeholder="rust, databases"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Structure" htmlFor="engagement" error={errors.engagement}>
            <select
              id="engagement"
              value={form.engagement}
              onChange={(event) => setForm({ ...form, engagement: event.target.value })}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
            >
              <option value="milestone">Milestone escrow</option>
              <option value="fixed">Fixed price</option>
              <option value="hourly">Hourly</option>
            </select>
          </Field>
          <Field label="Budget from" htmlFor="budgetMinUsd" error={errors.budgetMinUsd}>
            <Input
              id="budgetMinUsd"
              inputMode="decimal"
              value={form.budgetMinUsd}
              onChange={(event) => setForm({ ...form, budgetMinUsd: event.target.value })}
            />
          </Field>
          <Field label="Budget to" htmlFor="budgetMaxUsd" error={errors.budgetMaxUsd}>
            <Input
              id="budgetMaxUsd"
              inputMode="decimal"
              value={form.budgetMaxUsd}
              onChange={(event) => setForm({ ...form, budgetMaxUsd: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex items-center gap-2.5 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.isRemote}
              onChange={(event) => setForm({ ...form, isRemote: event.target.checked })}
              className="h-4 w-4 rounded border-border accent-[var(--accent)]"
            />
            Remote
          </label>
          <Field label="Location" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              value={form.location}
              maxLength={80}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="Optional"
            />
          </Field>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <Button type="submit" size="lg" loading={busy}>
          Publish role
        </Button>
      </div>
    </form>
  );
}
