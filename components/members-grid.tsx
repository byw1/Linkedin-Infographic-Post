"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type SocialKey = "linkedin" | "twitter" | "github" | "instagram" | "website";
type SocialMap = Partial<Record<SocialKey, string>>;

interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "user" | "admin";
  tags: string[];
  bio: string | null;
  socials: SocialMap;
  createdAt: string;
  isSelf: boolean;
}

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

const SOCIAL_KEYS: SocialKey[] = ["linkedin", "twitter", "github", "instagram", "website"];

export function MembersGrid() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  async function load(tag: string | null) {
    const params = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    const res = await fetch(`/api/members${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members);
  }

  useEffect(() => {
    void load(activeTag);
  }, [activeTag]);

  const allTags = useMemo(() => {
    if (!members) return [];
    const set = new Map<string, number>();
    for (const m of members) {
      for (const t of m.tags) set.set(t, (set.get(t) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [members]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className={`inline-flex h-7 items-center rounded-full border px-3 text-xs ${
            activeTag === null
              ? "border-primary bg-primary/10 text-primary-foreground"
              : "hover:bg-secondary"
          }`}
        >
          All
        </button>
        {allTags.map(([t, n]) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTag(t === activeTag ? null : t)}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 font-mono text-xs ${
              t === activeTag
                ? "border-primary bg-primary/10 text-foreground"
                : "hover:bg-secondary"
            }`}
          >
            {t}
            <span className="text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>

      {members === null && <p className="text-sm text-muted-foreground">Loading...</p>}
      {members && members.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {activeTag
            ? `No members tagged ${activeTag} yet.`
            : "No members yet."}
        </p>
      )}
      {members && members.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onSaved={() => void load(activeTag)}
              onTagClick={(t) => setActiveTag(t === activeTag ? null : t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  onSaved,
  onTagClick,
}: {
  member: Member;
  onSaved: () => void;
  onTagClick: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [tagsText, setTagsText] = useState(member.tags.join(", "));
  const [bio, setBio] = useState(member.bio ?? "");
  const [socials, setSocials] = useState<Record<SocialKey, string>>(() => {
    const out = {} as Record<SocialKey, string>;
    for (const k of SOCIAL_KEYS) out[k] = member.socials[k] ?? "";
    return out;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setTagsText(member.tags.join(", "));
    setBio(member.bio ?? "");
    const fresh = {} as Record<SocialKey, string>;
    for (const k of SOCIAL_KEYS) fresh[k] = member.socials[k] ?? "";
    setSocials(fresh);
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
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
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      setEditing(false);
      onSaved();
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-start gap-3">
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="truncate text-sm font-semibold">
              {member.name ?? member.email.split("@")[0]}
            </span>
            {member.role === "admin" && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                admin
              </span>
            )}
            {member.isSelf && (
              <span className="text-[10px] uppercase tracking-wide text-primary">
                you
              </span>
            )}
          </div>
          <a
            href={`mailto:${member.email}`}
            className="block truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {member.email}
          </a>
        </div>
        {member.isSelf && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
              Bio
            </span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={2}
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
                <span className="w-20 text-xs text-muted-foreground">{SOCIAL_LABEL[k]}</span>
                <input
                  value={socials[k]}
                  onChange={(e) => setSocials((s) => ({ ...s, [k]: e.target.value }))}
                  placeholder={SOCIAL_PLACEHOLDER[k]}
                  className="h-8 flex-1 rounded-md border bg-background px-2 font-mono text-xs"
                />
              </label>
            ))}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {member.bio && (
            <p className="text-sm text-muted-foreground">{member.bio}</p>
          )}
          {member.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {member.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onTagClick(t)}
                  className="inline-flex h-6 items-center rounded-full border bg-secondary/50 px-2 font-mono text-[11px] hover:bg-secondary"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {Object.keys(member.socials).length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {SOCIAL_KEYS.map((k) =>
                member.socials[k] ? (
                  <a
                    key={k}
                    href={member.socials[k]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 items-center rounded-md border px-2 hover:bg-secondary"
                  >
                    {SOCIAL_LABEL[k]}
                  </a>
                ) : null,
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Avatar({ member }: { member: Member }) {
  const initials = (member.name ?? member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  if (member.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={member.image}
        alt={member.name ?? member.email}
        className="h-12 w-12 rounded-full border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-secondary text-sm font-medium text-muted-foreground">
      {initials || "?"}
    </div>
  );
}
