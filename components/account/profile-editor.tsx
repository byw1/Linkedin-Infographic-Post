"use client";

import { useEffect, useState, useTransition } from "react";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { TagInput } from "@/components/ui/tag-input";

type SocialKey = "linkedin" | "twitter" | "github" | "instagram" | "website";

const SOCIAL_LABEL: Record<SocialKey, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  github: "GitHub",
  instagram: "Instagram",
  website: "Website",
};

const SOCIAL_PLACEHOLDER: Record<SocialKey, string> = {
  linkedin: "linkedin.com/in/your-handle or @your-handle",
  twitter: "twitter.com/your-handle or @your-handle",
  github: "github.com/your-handle",
  instagram: "instagram.com/your-handle",
  website: "https://example.com",
};

const SOCIAL_KEYS: SocialKey[] = [
  "linkedin",
  "twitter",
  "github",
  "instagram",
  "website",
];

interface InitialProfile {
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  tags: string[];
  socials: Partial<Record<SocialKey, string>>;
}

// Unified self-profile / admin-profile editor. Bio + tags + socials
// + avatar live together so the user can update them from /settings
// in one place. Submits text fields to `endpoint` (PATCH); avatar
// uploads go through `avatarEndpoint` separately so admins editing
// another member can target /api/admin/members/<id>/avatar without
// the user having to do anything themselves.
export function ProfileEditor({
  initial,
  endpoint,
  avatarEndpoint = "/api/account/avatar",
  removeAvatarConfirm = "Remove your profile picture?",
  editAvatar = true,
  onSaved,
}: {
  initial: InitialProfile;
  endpoint: string;
  // Override the avatar API endpoint — defaults to the self-only
  // /api/account/avatar; admin profile editing on /members/[id]
  // passes /api/admin/members/<id>/avatar.
  avatarEndpoint?: string;
  removeAvatarConfirm?: string;
  editAvatar?: boolean;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [socials, setSocials] = useState<Record<SocialKey, string>>(() => {
    const out = {} as Record<SocialKey, string>;
    for (const k of SOCIAL_KEYS) out[k] = initial.socials[k] ?? "";
    return out;
  });
  const [image, setImage] = useState<string | null>(initial.image);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull all currently-used member tags so the chip input can offer
  // them as suggestions — keeps the tag set tight ("fintech" reused
  // instead of "Fintech" / "fin-tech" parallels).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/tags/users");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setTagSuggestions(data.tags ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = (initial.name ?? initial.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  function save() {
    setError(null);
    setMessage(null);
    const cleanSocials: Record<string, string> = {};
    for (const k of SOCIAL_KEYS) {
      const v = socials[k]?.trim();
      if (v) cleanSocials[k] = v;
    }
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          tags,
          bio: bio.trim() || null,
          socials: cleanSocials,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setMessage("Saved.");
      onSaved?.();
    });
  }

  return (
    <div className="space-y-4 rounded-md border p-4">
      {editAvatar && (
        <div className="flex items-start gap-4">
          <AvatarUpload
            currentImage={image}
            initials={initials}
            size={72}
            onChange={setImage}
            endpoint={avatarEndpoint}
            removeConfirm={removeAvatarConfirm}
          />
          <p className="text-xs text-muted-foreground">
            Click the avatar to upload a new picture. JPG/PNG/WebP/GIF, up to 5MB.
          </p>
        </div>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
          Bio
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="One line about what you build."
          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </label>
      <div className="space-y-1.5">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Tags
        </span>
        <TagInput
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions}
          placeholder="fintech, b2b-saas, solo-founder…"
        />
      </div>
      <div className="space-y-2">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          Social links
        </span>
        {SOCIAL_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <span className="w-20 text-xs text-muted-foreground">
              {SOCIAL_LABEL[k]}
            </span>
            <input
              value={socials[k]}
              onChange={(e) =>
                setSocials((s) => ({ ...s, [k]: e.target.value }))
              }
              placeholder={SOCIAL_PLACEHOLDER[k]}
              className="h-8 flex-1 rounded-md border bg-background px-2 font-mono text-xs"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {message && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
    </div>
  );
}
