"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { FeedPostCard, type FeedPost } from "@/components/feed/feed-post-card";
import {
  TrackForm,
  type Tracking,
  trackingUpdatedLabel,
} from "@/components/tracking/track-form";

interface RenderRow {
  id: string;
  filename: string | null;
  url: string | null;
  status: string;
  // "single" / "carousel" / "tweet" are tool-generated. "external"
  // is a manually-tracked LinkedIn post that wasn't made here. null
  // on legacy renders predating the format column.
  format: "single" | "carousel" | "tweet" | "external" | null;
  hasSource: boolean;
  createdAt: string;
  completedAt: string | null;
  entityCount: number | null;
  tracking: Tracking;
}

type Tab = "mine" | "community";
type CommunityView = "recent" | "top";
type Period = "week" | "month" | "all";
type Sort = "engagement" | "impressions";

const PAGE_SIZE = 30;

// Posts archive — shows everything the user has rendered with a
// thumbnail + a Remix button that re-opens the post in the editor.
// Tracking metrics surface inline so a glance tells you which past
// posts hit. The Community tab is the merged community wall: a
// chronological "Recent" view + a "Top" leaderboard (formerly the
// /wins page) toggleable with a sub-pill. URL is the source of
// truth (?tab=&view=&period=&sort=) so links from /wins still land
// in the right spot.
export function PostsList() {
  const router = useRouter();
  const params = useSearchParams();

  const tab: Tab = params.get("tab") === "community" ? "community" : "mine";
  const view: CommunityView = params.get("view") === "top" ? "top" : "recent";
  const period: Period = parsePeriod(params.get("period"));
  const sort: Sort = parseSort(params.get("sort"));

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `/posts?${qs}` : "/posts", { scroll: false });
    },
    [params, router],
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex h-9 items-center bg-muted p-[3px] text-sm">
        <TabButton
          active={tab === "mine"}
          onClick={() =>
            setQuery({ tab: null, view: null, period: null, sort: null })
          }
        >
          My posts
        </TabButton>
        <TabButton
          active={tab === "community"}
          onClick={() => setQuery({ tab: "community" })}
        >
          Community
        </TabButton>
      </div>
      {tab === "mine" ? (
        <MinePosts />
      ) : (
        <CommunityFeed
          view={view}
          period={period}
          sort={sort}
          onViewChange={(v) => setQuery({ view: v === "recent" ? null : v })}
          onPeriodChange={(p) => setQuery({ period: p === "month" ? null : p })}
          onSortChange={(s) =>
            setQuery({ sort: s === "engagement" ? null : s })
          }
        />
      )}
    </div>
  );
}

function parsePeriod(v: string | null): Period {
  return v === "week" || v === "all" ? v : "month";
}

function parseSort(v: string | null): Sort {
  return v === "impressions" ? v : "engagement";
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
      className={`cursor-pointer px-3 py-1 font-medium outline-none focus-visible:border-ring ${
        active
          ? "bg-background text-foreground"
          : "text-foreground/60 hover:text-foreground"
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
  const [addingExternal, setAddingExternal] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Tip: come back any time to update tracking as your post matures — the
          &ldquo;Updated X ago&rdquo; label shows when you last logged numbers.
        </p>
        <button
          type="button"
          onClick={() => setAddingExternal((v) => !v)}
          className="inline-flex h-8 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
        >
          {addingExternal ? "Cancel" : "+ Add external post"}
        </button>
      </div>

      {addingExternal && (
        <ExternalPostForm
          onCreated={() => {
            setAddingExternal(false);
            void loadFirst();
          }}
          onCancel={() => setAddingExternal(false)}
        />
      )}

      {renders === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : renders.length === 0 ? (
        <div className="border bg-card p-8 text-center text-card-foreground">
          <p className="text-sm font-medium">No posts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate one from{" "}
            <Link href="/" className="underline">
              New post
            </Link>{" "}
            or click <strong>+ Add external post</strong> above to log a
            LinkedIn post you made elsewhere.
          </p>
        </div>
      ) : (
        <>
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
                className="inline-flex h-9 items-center border px-4 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExternalPostForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [showTracking, setShowTracking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Hold tracking input here so the user can fill metrics in one go
  // instead of "create row" → "update tracking". The TrackForm
  // hands its values back via the onSave callback.
  const [tracking, setTracking] = useState<Tracking>({
    post_url: null,
    published_at: null,
    post_text: null,
    impressions: null,
    reactions: null,
    comments: null,
    reposts: null,
    tracked_at: null,
  });

  function create(next?: Partial<Tracking>) {
    setError(null);
    const body = {
      title: title.trim(),
      post_url: next?.post_url ?? tracking.post_url,
      published_at: next?.published_at ?? tracking.published_at,
      post_text: next?.post_text ?? tracking.post_text,
      impressions: next?.impressions ?? tracking.impressions,
      reactions: next?.reactions ?? tracking.reactions,
      comments: next?.comments ?? tracking.comments,
      reposts: next?.reposts ?? tracking.reposts,
    };
    if (!body.title) {
      setError("Add a short title.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/posts/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="space-y-3 border bg-card p-4">
      <div className="text-xs text-muted-foreground">Add external post</div>
      <p className="text-xs text-muted-foreground">
        Logs a LinkedIn post you posted somewhere else (or earlier) so its
        metrics count toward your stats and the community feed. No file upload
        needed — just title + numbers.
      </p>
      <label className="block text-sm">
        <span className="block text-[11px] text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. 'Why I left FAANG' carousel"
          className="h-9 w-full border bg-background px-2 text-sm outline-none focus-visible:border-ring"
        />
      </label>
      <button
        type="button"
        onClick={() => setShowTracking((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        {showTracking ? "Hide metrics" : "Add metrics now (optional)"}
      </button>
      {showTracking ? (
        <TrackForm
          tracking={tracking}
          saveLabel="Add post"
          onSave={async (next) => {
            setTracking((prev) => ({ ...prev, ...next }));
            create(next);
          }}
          onCancel={onCancel}
        />
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => create()}
            disabled={pending}
            className="inline-flex h-9 items-center bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Adding..." : "Add post"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center border px-4 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const PERIOD_LABEL: Record<Period, string> = {
  week: "Past 7 days",
  month: "Past 30 days",
  all: "All time",
};

const SORT_LABEL: Record<Sort, string> = {
  engagement: "By engagement rate",
  impressions: "By impressions",
};

function CommunityFeed({
  view,
  period,
  sort,
  onViewChange,
  onPeriodChange,
  onSortChange,
}: {
  view: CommunityView;
  period: Period;
  sort: Sort;
  onViewChange: (v: CommunityView) => void;
  onPeriodChange: (p: Period) => void;
  onSortChange: (s: Sort) => void;
}) {
  const [recentPosts, setRecentPosts] = useState<FeedPost[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [topPosts, setTopPosts] = useState<FeedPost[] | null>(null);
  const [loadingMore, startLoadMore] = useTransition();

  // Load recent on mount; reload top when view becomes top or its
  // params change. Keep the two streams separate so flipping back
  // and forth doesn't refetch unnecessarily.
  useEffect(() => {
    if (view !== "recent") return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/feed/recent?limit=${PAGE_SIZE}`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setRecentPosts(data.posts);
      setNextCursor(data.next_cursor ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "top") return;
    let cancelled = false;
    setTopPosts(null);
    void (async () => {
      const res = await fetch(
        `/api/feed/wins?period=${period}&sort=${sort}&limit=24`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setTopPosts(data.posts);
    })();
    return () => {
      cancelled = true;
    };
  }, [view, period, sort]);

  function loadMoreRecent() {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const res = await fetch(
        `/api/feed/recent?limit=${PAGE_SIZE}&cursor=${nextCursor}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setRecentPosts((prev) => (prev ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.next_cursor ?? null);
    });
  }

  const posts = view === "recent" ? recentPosts : topPosts;
  const showLoadMore = view === "recent" && nextCursor;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          values={["recent", "top"] as const}
          active={view}
          labels={{ recent: "Recent", top: "Top" }}
          onChange={onViewChange}
        />
        {view === "top" && (
          <>
            <Pills
              values={["week", "month", "all"] as const}
              active={period}
              labels={PERIOD_LABEL}
              onChange={onPeriodChange}
            />
            <Pills
              values={["engagement", "impressions"] as const}
              active={sort}
              labels={SORT_LABEL}
              onChange={onSortChange}
            />
          </>
        )}
      </div>

      {posts === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {posts && posts.length === 0 && (
        <div className="space-y-2 border bg-card p-8 text-center text-card-foreground">
          <p className="text-sm font-medium">
            {view === "recent"
              ? "Nothing in the feed yet"
              : "No wins to show yet"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {view === "recent" ? (
              <>
                The Community feed shows posts members have tracked (filled in
                real LinkedIn impressions / reactions / comments) and
                haven&apos;t hidden via{" "}
                <Link href="/settings/sharing" className="underline">
                  Sharing
                </Link>
                . Once you publish a post, hit <strong>Track</strong> on it from
                the <em>My posts</em> tab to seed the feed.
              </>
            ) : (
              <>
                <strong>Top</strong> ranks tracked posts by engagement rate or
                reach. The leaderboard fills as members publish posts and add
                their LinkedIn metrics. Try a wider window above, or be the
                first to track one.
              </>
            )}
          </p>
        </div>
      )}
      {posts && posts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((p) => (
            <FeedPostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      {showLoadMore && posts && posts.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMoreRecent}
            disabled={loadingMore}
            className="inline-flex h-9 items-center border px-4 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function Pills<T extends string>({
  values,
  active,
  labels,
  onChange,
}: {
  values: readonly T[];
  active: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex h-8 items-center bg-muted p-[3px] text-xs">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`cursor-pointer px-3 py-1 font-medium outline-none focus-visible:border-ring ${
            active === v
              ? "bg-background text-foreground"
              : "text-foreground/60 hover:text-foreground"
          }`}
        >
          {labels[v]}
        </button>
      ))}
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
  const [editingTrack, setEditingTrack] = useState(false);

  function deleteRender() {
    if (!confirm("Delete this post? The rendered file is removed too.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/render/${r.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    });
  }

  async function saveTracking(next: Partial<Tracking>) {
    const body: Record<string, unknown> = {};
    if (next.post_url !== undefined) body.post_url = next.post_url || null;
    if (next.impressions !== undefined) body.impressions = next.impressions;
    if (next.reactions !== undefined) body.reactions = next.reactions;
    if (next.comments !== undefined) body.comments = next.comments;
    if (next.reposts !== undefined) body.reposts = next.reposts;
    const res = await fetch(`/api/render/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        typeof data.error === "string" ? data.error : "Save failed.",
      );
    }
    setEditingTrack(false);
    onChange();
  }

  const isPdf = r.format === "carousel";
  const isExternal = r.format === "external";
  const isTweet = r.format === "tweet";
  const dateStr = new Date(r.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const t = r.tracking;
  const hasMetrics =
    t.impressions !== null ||
    t.reactions !== null ||
    t.comments !== null ||
    t.reposts !== null;
  const tracked = t.tracked_at !== null;
  const updatedLabel = trackingUpdatedLabel(t.tracked_at);
  // "Posted Mar 14" / null. Surfaced in place of createdAt on cards
  // where the user has filled it in — that's the date that matters
  // for the algo / community-maturity gate.
  const publishedLabel = t.published_at
    ? `Posted ${new Date(t.published_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    : null;

  // Remix preselects the right editor mode via ?format= so the
  // home page doesn't have to fetch the render twice (once on
  // /posts and once on / to figure out which mode to show).
  // External posts have no source HTML, so Remix is hidden for them.
  const remixHref =
    r.hasSource && r.format && !isExternal
      ? `/?remix=${r.id}&format=${r.format}`
      : null;

  return (
    <div className="overflow-hidden border bg-card text-card-foreground">
      <div className="aspect-[4/5] bg-muted">
        {isExternal ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="bg-secondary px-3 py-1 text-[10px] font-medium">
              External · LinkedIn
            </span>
            {t.post_url && (
              <a
                href={t.post_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Open on LinkedIn ↗
              </a>
            )}
          </div>
        ) : r.url && !isPdf ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={r.url}
            alt={r.filename ?? "post"}
            className="h-full w-full object-cover"
          />
        ) : isPdf ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary">
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
              {/* Anchor date is "posted on" when the user has filled
               * it in (the truth they care about) — fall back to
               * createdAt for legacy rows / drafts that haven't
               * been logged yet. */}
              {publishedLabel ?? dateStr}
              {!isExternal && !isTweet && r.entityCount !== null && (
                <>
                  {" "}
                  · {r.entityCount} logo{r.entityCount === 1 ? "" : "s"}
                </>
              )}
              {isTweet && <> · tweet</>}
              {isExternal && <> · external</>}
            </div>
          </div>
        </div>

        {/* Post body excerpt — truncated to keep cards compact;
         * the full text lives in the tracking edit form. */}
        {t.post_text && (
          <p className="line-clamp-3 whitespace-pre-wrap text-[11px] leading-snug text-muted-foreground">
            {t.post_text}
          </p>
        )}

        {hasMetrics && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {t.impressions !== null && (
              <span title="Impressions">
                <strong className="text-foreground">
                  {fmtCount(t.impressions)}
                </strong>{" "}
                imp
              </span>
            )}
            {t.reactions !== null && (
              <span title="Reactions">
                <strong className="text-foreground">
                  {fmtCount(t.reactions)}
                </strong>{" "}
                rxn
              </span>
            )}
            {t.comments !== null && (
              <span title="Comments">
                <strong className="text-foreground">
                  {fmtCount(t.comments)}
                </strong>{" "}
                cmt
              </span>
            )}
            {t.reposts !== null && (
              <span title="Reposts">
                <strong className="text-foreground">
                  {fmtCount(t.reposts)}
                </strong>{" "}
                rep
              </span>
            )}
          </div>
        )}

        {updatedLabel && (
          <div className="text-[10px] text-muted-foreground">
            {updatedLabel}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {remixHref && (
            <Link
              href={remixHref}
              className="inline-flex h-8 items-center bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer outline-none focus-visible:border-ring"
            >
              Remix
            </Link>
          )}
          {r.url && !isExternal && (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
            >
              Open
            </a>
          )}
          <button
            type="button"
            onClick={() => setEditingTrack((v) => !v)}
            className="inline-flex h-8 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
          >
            {tracked ? "Update stats" : "Track"}
          </button>
          <button
            type="button"
            onClick={deleteRender}
            disabled={pending}
            className="ml-auto inline-flex h-8 items-center border border-destructive/40 px-2.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
          >
            Delete
          </button>
        </div>

        {editingTrack && (
          <TrackForm
            tracking={t}
            onSave={saveTracking}
            onCancel={() => setEditingTrack(false)}
          />
        )}

        {!isExternal && !r.hasSource && (
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
