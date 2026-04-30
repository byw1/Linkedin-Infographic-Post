"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { FeedPostCard, type FeedPost } from "@/components/feed/feed-post-card";

interface RenderRow {
  id: string;
  filename: string | null;
  url: string | null;
  status: string;
  format: "single" | "carousel" | null;
  hasSource: boolean;
  createdAt: string;
  completedAt: string | null;
  entityCount: number | null;
  tracking: {
    post_url: string | null;
    impressions: number | null;
    reactions: number | null;
    comments: number | null;
    reposts: number | null;
    tracked_at: string | null;
  };
}

type Tab = "mine" | "team";
const PAGE_SIZE = 30;

// Posts archive — shows everything the user has rendered with a
// thumbnail + a Remix button that re-opens the post in the editor.
// Tracking metrics surface inline so a glance tells you which past
// posts hit. Pagination via cursor; legacy renders without source
// HTML get the Remix button hidden (re-uploading from Claude is
// the only path to edit those).
export function PostsList() {
  const [tab, setTab] = useState<Tab>("mine");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border p-0.5 text-sm">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          My posts
        </TabButton>
        <TabButton active={tab === "team"} onClick={() => setTab("team")}>
          Team
        </TabButton>
      </div>
      {tab === "mine" ? <MinePosts /> : <TeamFeed />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function MinePosts() {
  const [renders, setRenders] = useState<RenderRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, startLoadMore] = useTransition();

  async function loadFirst() {
    const res = await fetch(`/api/renders?limit=${PAGE_SIZE}`);
    if (!res.ok) return;
    const data = await res.json();
    setRenders(data.renders);
    setNextCursor(data.next_cursor ?? null);
  }

  function loadMore() {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const res = await fetch(
        `/api/renders?limit=${PAGE_SIZE}&cursor=${nextCursor}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setRenders((prev) => (prev ? [...prev, ...data.renders] : data.renders));
      setNextCursor(data.next_cursor ?? null);
    });
  }

  useEffect(() => {
    void loadFirst();
  }, []);

  if (renders === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (renders.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-card p-8 text-center text-card-foreground">
        <p className="text-sm font-medium">No posts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate one from <Link href="/" className="underline">New post</Link>{" "}
          and it&apos;ll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {renders.map((r) => (
          <PostCard key={r.id} render={r} onChange={loadFirst} />
        ))}
      </div>
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
    </div>
  );
}

function TeamFeed() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, startLoadMore] = useTransition();

  async function loadFirst() {
    const res = await fetch(`/api/feed/recent?limit=${PAGE_SIZE}`);
    if (!res.ok) return;
    const data = await res.json();
    setPosts(data.posts);
    setNextCursor(data.next_cursor ?? null);
  }

  function loadMore() {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const res = await fetch(
        `/api/feed/recent?limit=${PAGE_SIZE}&cursor=${nextCursor}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setPosts((prev) => (prev ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.next_cursor ?? null);
    });
  }

  useEffect(() => {
    void loadFirst();
  }, []);

  if (posts === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-card p-8 text-center text-card-foreground">
        <p className="text-sm font-medium">No team posts yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          When your teammates track a post and have sharing on,
          it&apos;ll show up here. Track one of your own from the Mine
          tab to seed the feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {posts.map((p) => (
          <FeedPostCard key={p.id} post={p} />
        ))}
      </div>
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
    </div>
  );
}

function PostCard({
  render: r,
  onChange,
}: {
  render: RenderRow;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function deleteRender() {
    if (!confirm("Delete this post? The rendered file is removed too.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/render/${r.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    });
  }

  const isPdf = r.format === "carousel";
  const dateStr = new Date(r.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Compact tracking summary if any metrics are filled in.
  const t = r.tracking;
  const hasMetrics =
    t.impressions !== null ||
    t.reactions !== null ||
    t.comments !== null ||
    t.reposts !== null;

  // Remix preselects the right editor mode via ?format= so the
  // home page doesn't have to fetch the render twice (once on
  // /posts and once on / to figure out which mode to show).
  const remixHref = r.hasSource && r.format
    ? `/?remix=${r.id}&format=${r.format}`
    : null;

  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="aspect-[4/5] bg-muted">
        {r.url && !isPdf ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={r.url}
            alt={r.filename ?? "post"}
            className="h-full w-full object-cover"
          />
        ) : isPdf ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
              Carousel · PDF
            </span>
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Open PDF
              </a>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {r.status === "pending" || r.status === "rendering"
              ? "Rendering…"
              : r.status === "failed"
                ? "Failed"
                : "No preview"}
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {r.filename ?? "Untitled"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {dateStr}
              {r.entityCount !== null && (
                <>
                  {" "}
                  · {r.entityCount} logo{r.entityCount === 1 ? "" : "s"}
                </>
              )}
            </div>
          </div>
        </div>

        {hasMetrics && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {t.impressions !== null && (
              <span title="Impressions">
                <strong className="text-foreground">{fmtCount(t.impressions)}</strong> imp
              </span>
            )}
            {t.reactions !== null && (
              <span title="Reactions">
                <strong className="text-foreground">{fmtCount(t.reactions)}</strong> rxn
              </span>
            )}
            {t.comments !== null && (
              <span title="Comments">
                <strong className="text-foreground">{fmtCount(t.comments)}</strong> cmt
              </span>
            )}
            {t.reposts !== null && (
              <span title="Reposts">
                <strong className="text-foreground">{fmtCount(t.reposts)}</strong> rep
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {remixHref && (
            <Link
              href={remixHref}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Remix
            </Link>
          )}
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
            >
              Open
            </a>
          )}
          <button
            type="button"
            onClick={deleteRender}
            disabled={pending}
            className="ml-auto inline-flex h-8 items-center rounded-md border border-destructive/40 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        {!r.hasSource && (
          <div className="text-[10px] italic text-muted-foreground">
            Saved before Remix shipped — re-upload from Claude to edit.
          </div>
        )}
      </div>
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
