"use client";

import { useEffect, useState } from "react";
import type { FeedPost } from "@/components/feed/feed-post-card";

interface Props {
  memberId: string;
}

// Horizontal slideshow rail of a member's top shared posts. Used
// inside MemberCard. Renders nothing when the member has sharing
// off, no tracked posts, or hasn't logged any impressions yet —
// the rail is purely additive, never a placeholder.
export function MemberTopPosts({ memberId }: Props) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/feed/user/${memberId}?sort=engagement&limit=5`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setPosts(data.posts);
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  if (!posts || posts.length === 0) return null;

  return (
    <div className="space-y-1.5 border-t pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Top posts
        </span>
        <span className="text-[10px] text-muted-foreground">
          by engagement
        </span>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {posts.map((p) => (
          <PostThumb key={p.id} post={p} />
        ))}
      </div>
    </div>
  );
}

function PostThumb({ post }: { post: FeedPost }) {
  const isPdf = post.format === "carousel";
  const rate = post.engagementRate;
  const rateStr = rate === null ? null : `${(rate * 100).toFixed(1)}%`;
  // Click target: prefer the published LinkedIn URL (most useful)
  // and fall back to the rendered file so the thumbnail is always
  // navigable.
  const href = post.postUrl ?? post.url ?? "#";

  return (
    <a
      href={href}
      target={post.postUrl ? "_blank" : undefined}
      rel="noreferrer"
      className="group flex w-24 shrink-0 flex-col gap-1"
      title={post.filename ?? "post"}
    >
      <div className="aspect-[4/5] overflow-hidden rounded-md border bg-muted">
        {post.url && !isPdf ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.url}
            alt={post.filename ?? "post"}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-wide text-muted-foreground">
            {isPdf ? "PDF" : "—"}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">{fmtCount(post.impressions)}</span>
        <span className="text-foreground">{rateStr ?? "—"}</span>
      </div>
    </a>
  );
}

function fmtCount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
