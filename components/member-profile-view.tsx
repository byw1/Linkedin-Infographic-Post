"use client";

import { useEffect, useState, useTransition } from "react";
import { FeedPostCard, type FeedPost } from "@/components/feed/feed-post-card";

type SocialKey = "linkedin" | "twitter" | "github" | "instagram" | "website";

const SOCIAL_LABEL: Record<SocialKey, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  github: "GitHub",
  instagram: "Instagram",
  website: "Website",
};

const SOCIAL_KEYS: SocialKey[] = [
  "linkedin",
  "twitter",
  "github",
  "instagram",
  "website",
];

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

export function MemberProfileView({ member }: { member: MemberProfile }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, startLoadMore] = useTransition();

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

  const displayName = member.name ?? member.email.split("@")[0];
  // Stats are visible if the viewer is the member themselves or
  // sharing is on. Mirrors the directory-card rule.
  const showStats = member.isSelf || member.shareTracked;
  const showPosts = showStats; // posts feed honors the same rule

  return (
    <div className="space-y-8">
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
          </div>
          <a
            href={`mailto:${member.email}`}
            className="block text-xs text-muted-foreground hover:text-foreground"
          >
            {member.email}
          </a>
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
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              {SOCIAL_KEYS.map((k) =>
                member.socials[k] ? (
                  <a
                    key={k}
                    href={member.socials[k]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 items-center rounded-md border px-2 hover:bg-secondary"
                  >
                    {SOCIAL_LABEL[k]} ↗
                  </a>
                ) : null,
              )}
            </div>
          )}
        </div>
      </header>

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

function Avatar({
  member,
  size = 56,
}: {
  member: { name: string | null; email: string; image: string | null };
  size?: number;
}) {
  const initials = (member.name ?? member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
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
