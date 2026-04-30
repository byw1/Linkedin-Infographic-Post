"use client";

import { useEffect, useState } from "react";
import { FeedPostCard, type FeedPost } from "@/components/feed/feed-post-card";

type Period = "week" | "month" | "all";
type Sort = "engagement" | "impressions";

const PERIOD_LABEL: Record<Period, string> = {
  week: "Past 7 days",
  month: "Past 30 days",
  all: "All time",
};

const SORT_LABEL: Record<Sort, string> = {
  engagement: "By engagement rate",
  impressions: "By impressions",
};

export function WinsView() {
  const [period, setPeriod] = useState<Period>("month");
  const [sort, setSort] = useState<Sort>("engagement");
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    void (async () => {
      const res = await fetch(
        `/api/feed/wins?period=${period}&sort=${sort}&limit=24`,
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      setPosts(data.posts);
    })();
    return () => {
      cancelled = true;
    };
  }, [period, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pills
          values={["week", "month", "all"] as const}
          active={period}
          labels={PERIOD_LABEL}
          onChange={setPeriod}
        />
        <Pills
          values={["engagement", "impressions"] as const}
          active={sort}
          labels={SORT_LABEL}
          onChange={setSort}
        />
      </div>

      {posts === null && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {posts && posts.length === 0 && (
        <div className="space-y-2 rounded-lg border-2 border-dashed bg-card p-8 text-center text-card-foreground">
          <p className="text-sm font-medium">No wins to show yet</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Wins ranks tracked posts by engagement rate or reach. The
            leaderboard fills up as soon as a member publishes a post,
            comes back here, hits <strong>Track</strong> on the render,
            and types in the LinkedIn numbers (impressions / reactions /
            comments / reposts). Try a wider window above, or be the first
            to track one.
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
    <div className="inline-flex rounded-md border p-0.5 text-xs">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            active === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
