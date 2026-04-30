"use client";

import { useState, useTransition } from "react";
import { AvatarUpload } from "@/components/account/avatar-upload";

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
// in one place. Submits to `endpoint` which is /api/account/profile
// for self, /api/admin/members/<id> for admins editing others.
//
// `editAvatar` controls whether the avatar upload widget is shown.
// We don't currently support admin avatar uploads on behalf of
// other members — admins edit everything except the avatar (which
// is uploaded by the member themselves).
export function ProfileEditor({
  initial,
  endpoint,
  editAvatar = true,
  onSaved,
}: {
  initial: InitialProfile;
  endpoint: string;
  editAvatar?: boolean;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [socials, setSocials] = useState<Record<SocialKey, string>>(() => {
    const out = {} as Record<SocialKey, string>;
    for (const k of SOCIAL_KEYS) out[k] = initial.socials[k] ?? "";
    return out;
  });
  const [image, setImage] = useState<string | null>(initial.image);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initials = (initial.name ?? initial.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  function save() {
    setError(null);
    setMessage(null);
    const tags = tagsText
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
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
      <label className="block text-sm">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
          Tags
          <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
            comma-separated, lowercase, hyphenated
          </span>
        </span>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="fintech, b2b-saas, solo-founder"
          className="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs"
        />
      </label>
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
