"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { uploadToStorage } from "@/lib/upload";
import type { SelfUser, Upload } from "@/lib/types";
import { useToast } from "../layout/toast";
import { Avatar, Button, Card, Field, Input, Textarea } from "../ui";
import { UploadIcon } from "../ui/icons";

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The one form a new account is asked to fill in.
 *
 * Everything here is public, so it is phrased as choices rather than as data
 * entry: the handle becomes a URL, the name is what the site credits, and the
 * picture is what a reader recognises in a feed of work. The picture is optional
 * — the site renders initials from the display name when there is none, which is
 * a complete answer rather than a placeholder.
 */
export function OnboardingForm({ initial, next }: { initial: SelfUser; next: string }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [handle, setHandle] = useState(initial.handle);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [names, setNames] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // The uploaded key is what gets saved; the object URL is only the preview, so
  // the picture a person sees while filling this in is their own file rather than
  // a round trip to storage.
  const [avatarKey, setAvatarKey] = useState("");
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  async function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("That image is over 8 MB. Choose a smaller one.");
      return;
    }

    setUploading(true);
    try {
      const upload = await api<Upload>("/v1/uploads/avatar", {
        body: { contentType: file.type, sizeBytes: file.size },
      });
      await uploadToStorage(upload.url, file);
      setAvatarKey(upload.key);
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That image did not upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api<SelfUser>("/v1/me/onboarding", {
        body: {
          handle: handle.trim().toLowerCase(),
          displayName: displayName.trim(),
          bio,
          avatarKey,
        },
      });
      toast.success("Profile saved.");
      router.replace(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (Object.keys(err.fields).length === 0) toast.error(err.message);
      } else {
        toast.error("Could not save your profile.");
      }
      setSaving(false);
    }
  }

  const cleanHandle = handle.trim().toLowerCase();
  const handleUsable = /^[a-z0-9_]{3,30}$/.test(cleanHandle);

  return (
    <Card as="section" className="mt-8 p-5 sm:p-6">
      <form onSubmit={save} className="space-y-6" noValidate>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={displayName || initial.handle} src={preview || undefined} size={72} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium">Picture</p>
            <p className="mt-1 text-[13px] leading-relaxed text-fg-subtle">
              Optional. Without one, your initials are used. JPEG, PNG or WebP, up to 8 MB.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <UploadIcon size={14} />
                {preview ? "Replace" : "Upload"}
              </Button>
              {preview ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    URL.revokeObjectURL(preview);
                    setPreview("");
                    setAvatarKey("");
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void chooseAvatar(e)}
          />
        </div>

        <Field
          label="What should the site call you?"
          htmlFor="displayName"
          hint="Shown beside your work. Your name, a studio name, whatever you are known by."
          error={errors.displayName}
        >
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            autoComplete="name"
            required
          />
        </Field>

        <Field
          label="Your handle"
          htmlFor="handle"
          hint={
            handleUsable
              ? `Your creator page will live at /creator/${cleanHandle}`
              : "Three to thirty characters: letters, numbers and underscores."
          }
          error={errors.handle}
        >
          <Input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </Field>

        <Field
          label="What do you make?"
          htmlFor="bio"
          hint="A line or two. A reviewer reads it, and so does anyone deciding whether to sponsor you."
          error={errors.bio}
        >
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={600}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button
            type="submit"
            loading={saving}
            disabled={!handleUsable || displayName.trim() === ""}
          >
            Save and continue
          </Button>
          <p className="text-[12.5px] text-fg-subtle">
            Everything here is public and can be changed later.
          </p>
        </div>
      </form>
    </Card>
  );
}
