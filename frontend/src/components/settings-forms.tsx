"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SelfUser, SocialPlatform, Wallet } from "@/lib/types";
import { connectWallet, signOwnershipProof, walletAvailable, WalletError } from "@/lib/wallet";
import { Button, Card, Field, Input, Textarea } from "./ui";
import { CheckIcon, WalletIcon } from "./icons";
import { shortAddress } from "@/lib/format";

/** Editable profile fields. */
export function ProfileSettings({ user }: { user: SelfUser }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: user.displayName,
    headline: user.headline ?? "",
    bio: user.bio ?? "",
    location: user.location ?? "",
    skills: user.skills.join(", "),
    openToWork: user.openToWork,
    hourlyRateUsd: user.hourlyRateUsd ? String(user.hourlyRateUsd) : "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    setErrors({});
    try {
      await api("/v1/me", {
        method: "PATCH",
        body: {
          displayName: form.displayName,
          headline: form.headline,
          bio: form.bio,
          location: form.location,
          skills: form.skills.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
          openToWork: form.openToWork,
          hourlyRateUsd: form.hourlyRateUsd ? Number(form.hourlyRateUsd) : null,
        },
      });
      setState("saved");
      router.refresh();
    } catch (err) {
      setState("idle");
      if (err instanceof ApiError) setErrors(err.fields);
    }
  }

  return (
    <Card className="p-6" as="section">
      <h2 className="text-[17px] font-semibold">Profile</h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        This is what people see before they decide to sponsor or hire you.
      </p>

      <form onSubmit={save} className="mt-6 space-y-5">
        <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
          <Input
            id="displayName"
            value={form.displayName}
            maxLength={60}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </Field>

        <Field
          label="Headline"
          htmlFor="headline"
          hint="One line. What you are working on right now."
          error={errors.headline}
        >
          <Input
            id="headline"
            value={form.headline}
            maxLength={120}
            onChange={(event) => setForm({ ...form, headline: event.target.value })}
          />
        </Field>

        <Field label="Bio" htmlFor="bio" error={errors.bio}>
          <Textarea
            id="bio"
            rows={4}
            maxLength={2000}
            value={form.bio}
            onChange={(event) => setForm({ ...form, bio: event.target.value })}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Location" htmlFor="location" error={errors.location}>
            <Input
              id="location"
              value={form.location}
              maxLength={80}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
            />
          </Field>
          <Field label="Skills" htmlFor="skills" hint="Comma separated." error={errors.skills}>
            <Input
              id="skills"
              value={form.skills}
              onChange={(event) => setForm({ ...form, skills: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Hourly rate in USD" htmlFor="rate" error={errors.hourlyRateUsd}>
            <Input
              id="rate"
              inputMode="decimal"
              value={form.hourlyRateUsd}
              onChange={(event) => setForm({ ...form, hourlyRateUsd: event.target.value })}
              placeholder="Optional"
            />
          </Field>
          <label className="flex items-end gap-2.5 pb-2.5 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={form.openToWork}
              onChange={(event) => setForm({ ...form, openToWork: event.target.checked })}
              className="h-4 w-4 rounded border-border accent-[var(--accent)]"
            />
            Show me in the hire directory
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          {state === "saved" ? (
            <span className="flex items-center gap-1.5 text-[13px] text-accent" role="status">
              <CheckIcon size={15} />
              Saved
            </span>
          ) : null}
          <Button type="submit" loading={state === "saving"}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

const PLATFORMS: { value: SocialPlatform; label: string; placeholder: string }[] = [
  { value: "x", label: "X", placeholder: "https://x.com/yourhandle" },
  { value: "github", label: "GitHub", placeholder: "https://github.com/yourhandle" },
  { value: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourhandle" },
  { value: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourhandle" },
  { value: "website", label: "Website", placeholder: "https://yoursite.com" },
];

/** Linking external accounts. Each link is pinned to its platform's domain. */
export function SocialSettings({ user }: { user: SelfUser }) {
  const router = useRouter();
  const [platform, setPlatform] = useState<SocialPlatform>("x");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = PLATFORMS.find((p) => p.value === platform);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/social/${platform}`, { method: "PUT", body: { username, url } });
      setUsername("");
      setUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.url ?? err.message) : "That link was rejected.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(value: SocialPlatform) {
    await api(`/v1/me/social/${value}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Card className="p-6" as="section">
      <h2 className="text-[17px] font-semibold">Linked accounts</h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        Links must point at the real platform domain, so nobody can pass off a lookalike as their
        GitHub.
      </p>

      {user.socialLinks.length > 0 ? (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {user.socialLinks.map((link) => (
            <li key={link.platform} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium capitalize">{link.platform}</p>
                <p className="truncate text-[13px] text-fg-muted">{link.url}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(link.platform)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={add} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="Platform" htmlFor="platform">
            <select
              id="platform"
              value={platform}
              onChange={(event) => setPlatform(event.target.value as SocialPlatform)}
              className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm"
            >
              {PLATFORMS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Username" htmlFor="username">
            <Input
              id="username"
              value={username}
              maxLength={100}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>
        </div>
        <Field label="URL" htmlFor="url" error={error ?? undefined}>
          <Input
            id="url"
            type="url"
            value={url}
            placeholder={current?.placeholder}
            onChange={(event) => setUrl(event.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={busy} disabled={!username || !url}>
            Add link
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface ChallengeResponse {
  message: string;
  nonce: string;
  issuedAt: string;
}

/**
 * Connecting a wallet.
 *
 * The wallet signs a server-issued nonce. That proves control of the address
 * without authorising any transfer, which is why the copy says so plainly —
 * people should be suspicious of any site that asks for more.
 */
export function WalletSettings({ wallets }: { wallets: Wallet[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Detected after mount; see the note in sponsor-panel.tsx.
  const [hasExtension, setHasExtension] = useState(true);

  useEffect(() => setHasExtension(walletAvailable()), []);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const address = await connectWallet();
      const challenge = await api<ChallengeResponse>("/v1/auth/wallet/challenge", {
        body: { address },
      });
      const signature = await signOwnershipProof(challenge.message);
      await api("/v1/auth/wallet/verify", {
        body: {
          address,
          nonce: challenge.nonce,
          signature,
          issuedAt: challenge.issuedAt,
          primary: wallets.length === 0,
        },
      });
      router.refresh();
    } catch (err) {
      if (err instanceof WalletError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else setError("The wallet could not be verified. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6" as="section">
      <h2 className="text-[17px] font-semibold">Wallet</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
        Sponsorships and released milestones are paid straight to your primary wallet. We ask your
        wallet to sign a one-time message to prove you control the address; it authorises no
        transfer, and we will never ask for a seed phrase.
      </p>

      {wallets.length > 0 ? (
        <ul className="mt-5 divide-y divide-border border-y border-border">
          {wallets.map((wallet) => (
            <li key={wallet.address} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <WalletIcon size={17} className="text-fg-subtle" />
                <span className="font-mono text-[13px]">{shortAddress(wallet.address)}</span>
              </div>
              {wallet.isPrimary ? (
                <span className="text-[12px] font-medium text-accent">Primary</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-5">
        <Button variant="secondary" onClick={connect} loading={busy} disabled={!hasExtension}>
          <WalletIcon size={16} />
          {wallets.length > 0 ? "Connect another wallet" : "Connect a wallet"}
        </Button>
        {!hasExtension ? (
          <p className="mt-2 text-[12px] text-fg-subtle">
            No Solana wallet extension detected in this browser.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** Signing out, and the destructive-actions corner of settings. */
export function AccountSettings({ user }: { user: SelfUser }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await api("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="p-6" as="section">
      <h2 className="text-[17px] font-semibold">Account</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Email</dt>
          <dd className="truncate">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-fg-muted">Handle</dt>
          <dd>@{user.handle}</dd>
        </div>
      </dl>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={signOut} loading={busy}>
          Sign out
        </Button>
      </div>
    </Card>
  );
}
