"use client";

import { useEffect, useState, useTransition } from "react";
import { ProfileEditor } from "@/components/account/profile-editor";
import { FeedPostCard, type FeedPost } from "@/components/feed/feed-post-card";
import { SocialIcons, type SocialKey } from "@/components/social-icons";

interface MemberProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "user" | "admin";
  tags: string[];
  bio: string | null;
  socials: Partial<Record<SocialKey, string>>;
  createdAt: string;
  lastSeenAt: string | null;
  banned: boolean;
  isSelf: boolean;
  shareTracked: boolean;
  stats: {
    postsShared: number;
    totalImpressions: number;
    avgEngagementRate: number | null;
    lastTrackedAt: string | null;
  };
}

const PAGE_SIZE = 24;

export function MemberProfileView({
  member,
  viewerIsAdmin,
}: {
  member: MemberProfile;
  viewerIsAdmin: boolean;
}) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, startLoadMore] = useTransition();
  const [showAdminEdit, setShowAdminEdit] = useState(false);
  const [pending, startTransition] = useTransition();
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/members/${member.id}/posts?limit=${PAGE_SIZE}`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setPosts(data.posts);
      setNextCursor(data.next_cursor ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  // Open the admin editor when the URL hash is #admin-edit (link
  // target from the directory's "Edit profile" admin button).
  useEffect(() => {
    if (
      viewerIsAdmin &&
      !member.isSelf &&
      typeof window !== "undefined" &&
      window.location.hash === "#admin-edit"
    ) {
      setShowAdminEdit(true);
    }
  }, [viewerIsAdmin, member.isSelf]);

  function loadMore() {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const res = await fetch(
        `/api/members/${member.id}/posts?limit=${PAGE_SIZE}&cursor=${nextCursor}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setPosts((prev) => (prev ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.next_cursor ?? null);
    });
  }

  function ban(banned: boolean) {
    setAdminError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/members/${member.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminError(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      window.location.reload();
    });
  }

  function remove() {
    if (
      !confirm(
        `Permanently remove ${member.name ?? member.email}? This deletes their account, renders, themes, and uploads. Cannot be undone.`,
      )
    )
      return;
    setAdminError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminError(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      window.location.href = "/members";
    });
  }

  const displayName = member.name ?? member.email.split("@")[0];
  const showStats = member.isSelf || member.shareTracked;
  const showPosts = showStats;
  const adminCanEdit = viewerIsAdmin && !member.isSelf;

  return (
    <div className="space-y-8">
      {member.banned && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <strong className="font-semibold text-destructive">Banned.</strong>{" "}
          <span className="text-muted-foreground">
            {member.isSelf
              ? "Your account has been suspended. Contact an admin."
              : "This member is banned. Sign-in is blocked and they're hidden from non-admin views."}
          </span>
        </div>
      )}

      <header className="flex flex-wrap items-start gap-5 rounded-lg border bg-card p-6 text-card-foreground">
        <Avatar member={member} size={80} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            {member.role === "admin" && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                admin
              </span>
            )}
            {member.isSelf && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                you
              </span>
            )}
            {member.banned && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                banned
              </span>
            )}
          </div>
          <a
            href={`mailto:${member.email}`}
            className="block text-xs text-muted-foreground hover:text-foreground"
          >
            {member.email}
          </a>
          <p className="text-[11px] text-muted-foreground">
            {lastSeenLabel(member.lastSeenAt)}
          </p>
          {member.bio && <p className="text-sm">{member.bio}</p>}
          {member.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {member.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex h-6 items-center rounded-full border bg-secondary/50 px-2 font-mono text-[11px]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {Object.keys(member.socials).length > 0 && (
            <div className="pt-1">
              <SocialIcons socials={member.socials} size={16} />
            </div>
          )}
          {member.isSelf && (
            <div className="pt-2">
              <a
                href="/settings/profile"
                className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
              >
                Edit your profile in settings →
              </a>
            </div>
          )}
        </div>
      </header>

      {adminCanEdit && (
        <section
          id="admin-edit"
          className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Admin actions
            </span>
            <button
              type="button"
              onClick={() => setShowAdminEdit((v) => !v)}
              className="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-background"
            >
              {showAdminEdit ? "Hide editor" : "Edit profile"}
            </button>
            <button
              type="button"
              onClick={() => ban(!member.banned)}
              disabled={pending}
              className="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-background disabled:opacity-50"
            >
              {member.banned ? "Unban" : "Ban"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Remove permanently
            </button>
            {adminError && (
              <span className="text-xs text-destructive">{adminError}</span>
            )}
          </div>
          {showAdminEdit && (
            <ProfileEditor
              endpoint={`/api/admin/members/${member.id}`}
              avatarEndpoint={`/api/admin/members/${member.id}/avatar`}
              removeAvatarConfirm={`Remove ${member.name ?? member.email}'s profile picture?`}
              initial={{
                name: member.name,
                email: member.email,
                image: member.image,
                bio: member.bio,
                tags: member.tags,
                socials: member.socials,
              }}
              onSaved={() => {
                // Force a re-fetch so the displayed header values
                // match the new ones the admin just saved.
                window.location.reload();
              }}
            />
          )}
        </section>
      )}

      {showStats ? (
        member.stats.postsShared > 0 ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Posts tracked" value={String(member.stats.postsShared)} />
            <Stat
              label="Total impressions"
              value={fmtCount(member.stats.totalImpressions)}
            />
            <Stat
              label="Avg engagement"
              value={
                member.stats.avgEngagementRate !== null
                  ? `${(member.stats.avgEngagementRate * 100).toFixed(1)}%`
                  : "—"
              }
            />
            <Stat
              label="Last tracked"
              value={fmtRelative(member.stats.lastTrackedAt)}
            />
          </section>
        ) : (
          <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            {member.isSelf
              ? "You haven't tracked any posts yet. Render one in New post, publish it, then click Track on the result to log impressions / reactions."
              : `${displayName} hasn't tracked any posts yet.`}
          </p>
        )
      ) : (
        <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          {displayName} keeps their tracking private.
        </p>
      )}

      {showPosts && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tracked posts
            </h2>
          </div>
          {posts === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {posts && posts.length === 0 && (
            <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Nothing here yet.
            </p>
          )}
          {posts && posts.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((p) => (
                <FeedPostCard key={p.id} post={p} />
              ))}
            </div>
          )}
          {nextCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-secondary disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3 text-card-foreground">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}

function initialsFor(member: { name: string | null; email: string }): string {
  return (member.name ?? member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({
  member,
  size = 56,
}: {
  member: { name: string | null; email: string; image: string | null };
  size?: number;
}) {
  const initials = initialsFor(member);
  if (member.image) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={member.image}
        alt={member.name ?? member.email}
        width={size}
        height={size}
        className="shrink-0 rounded-full border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border bg-secondary font-medium text-muted-foreground"
      style={{ width: size, height: size, fontSize: Math.round(size / 3) }}
    >
      {initials || "?"}
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1mo ago";
  return `${months}mo ago`;
}

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "Never seen";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Active just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `Active ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Active ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Active yesterday";
  if (d < 7) return `Active ${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `Active ${w}w ago`;
  const mo = Math.floor(d / 30);
  return `Active ${mo}mo ago`;
}
