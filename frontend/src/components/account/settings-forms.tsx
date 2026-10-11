"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api/client";
import { shortAddress } from "@/lib/format";
import { connectWallet, signOwnershipProof, walletAvailable, WalletError } from "@/lib/wallet";
import type { SelfUser, Upload } from "@/lib/types";
import { uploadToStorage } from "@/lib/upload";
import { Avatar, Button, Card, Field, Input, Textarea } from "../ui";
import { useToast } from "../layout/toast";
import { CheckIcon, WalletIcon } from "../ui/icons";

export function ProfileForm({ user }: { user: SelfUser }) {
  const router = useRouter();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      await api<SelfUser>("/v1/me", {
        method: "PATCH",
        body: { displayName: displayName.trim(), handle: handle.trim().toLowerCase(), bio },
      });
      toast.success("Profile saved.");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields);
        if (!Object.keys(err.fields).length) toast.error(err.message);
      } else {
        toast.error("Could not save your profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" className="p-5">
      <h2 className="text-[15px] font-semibold">Profile</h2>
      <form onSubmit={save} className="mt-4 space-y-5" noValidate>
        <Field label="Display name" htmlFor="displayName" error={fieldErrors.displayName}>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            required
          />
        </Field>

        <Field
          label="Handle"
          htmlFor="handle"
          hint="Your profile lives at /creator/your-handle."
          error={fieldErrors.handle}
        >
          <Input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={30}
            required
          />
        </Field>

        <Field label="Bio" htmlFor="bio" error={fieldErrors.bio}>
          <Textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={600}
            placeholder="What you work on."
          />
        </Field>

        <Button type="submit" loading={saving}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

export function WalletForm({ user }: { user: SelfUser }) {
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    setError("");
    if (!walletAvailable()) {
      setError("No Solana wallet found in this browser. Install one, then reload this page.");
      return;
    }
    setBusy(true);
    try {
      const address = await connectWallet();
      const challenge = await api<{ message: string; nonce: string; issuedAt: string }>(
        "/v1/me/wallet/challenge",
        { body: { address } },
      );
      const signature = await signOwnershipProof(challenge.message);
      await api<SelfUser>("/v1/me/wallet/verify", {
        body: { address, nonce: challenge.nonce, signature, issuedAt: challenge.issuedAt },
      });
      toast.success("Wallet verified.");
      router.refresh();
    } catch (err) {
      if (err instanceof WalletError) setError(err.message);
      else if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error && /reject|denied|cancel/i.test(err.message))
        setError("You cancelled the signature request.");
      else setError("Could not verify that wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="p-5">
      <h2 className="text-[15px] font-semibold">Payout wallet</h2>
      <p className="mt-1.5 text-sm text-fg-muted">
        Donations are sent here directly. Hustle On never holds them and never asks for a seed phrase
        — signing this message proves the key is yours and moves nothing.
      </p>

      {user.payoutVerified && user.payoutAddress ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-accent-soft px-3 py-1.5 text-[13px] text-accent">
            <CheckIcon size={14} />
            Verified
          </span>
          <code className="font-mono text-[13px] text-fg-muted">
            {shortAddress(user.payoutAddress)}
          </code>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button onClick={verify} loading={busy} variant="secondary" className="mt-4">
        <WalletIcon size={16} />
        {user.payoutVerified ? "Change wallet" : "Connect and verify"}
      </Button>
    </Card>
  );
}

export function SignOutButton({ everywhere = false }: { everywhere?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await api(everywhere ? "/v1/auth/logout-all" : "/v1/auth/logout", { method: "POST" });
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <Button onClick={signOut} loading={busy} variant={everywhere ? "secondary" : "ghost"}>
      {everywhere ? "Sign out everywhere" : "Sign out"}
    </Button>
  );
}

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The picture on the account, changeable after onboarding.
 *
 * The claim an upload makes is the key it leaves in the bucket, and the API
 * refuses a key this account did not upload — so the form uploads first and
 * claims second, and a picture somebody else uploaded cannot be adopted by
 * guessing its path. Removing the picture is a first-class action rather than an
 * empty upload, because "no picture" is a complete answer: the site falls back to
 * the account's initials.
 */
export function AvatarForm({ user }: { user: SelfUser }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("That image is over 8 MB. Choose a smaller one.");
      return;
    }

    setBusy(true);
    try {
      const upload = await api<Upload>("/v1/uploads/avatar", {
        body: { contentType: file.type, sizeBytes: file.size },
      });
      await uploadToStorage(upload.url, file);
      await api<SelfUser>("/v1/me/avatar", { method: "PUT", body: { key: upload.key } });
      toast.success("Picture updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That image did not upload.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await api<SelfUser>("/v1/me/avatar", { method: "DELETE" });
      toast.success("Picture removed.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove the picture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="p-5">
      <h2 className="text-[15px] font-semibold">Picture</h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Avatar name={user.displayName} src={user.avatarUrl} size={56} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => fileRef.current?.click()}
          >
            {user.avatarUrl ? "Change picture" : "Add a picture"}
          </Button>
          {user.avatarUrl ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void clear()}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-fg-subtle">
        JPEG, PNG or WebP, up to 8 MB. Without one, the site shows your initials.
      </p>
    </Card>
  );
}
