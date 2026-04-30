import { prisma } from "@/lib/db";

// Per-member rollup of tracked posts. The same shape is used by the
// /members directory cards (one stats row per member) and by the
// per-member profile page (`/members/[id]`). Computed by aggregating
// the renders rows directly — no separate stats table to keep in
// sync. For a small community this is cheap; once the archive
// crosses ~10k tracked rows we'd want a materialized view or a
// nightly snapshot.
export interface MemberStats {
  postsShared: number;
  totalImpressions: number;
  avgEngagementRate: number | null;
  lastTrackedAt: Date | null;
}

// Map of userId → stats. Batch query so the directory render can
// fetch every member's stats in a single round trip instead of N+1.
// Filters mirror the feed eligibility:
//   - trackedAt set (only logged posts count)
//   - impressions > 0 (without a denominator we can't compute
//     engagement rate; also drops zero-reach posts from the rollup)
// shareTracked is *not* applied here — own-profile views want full
// stats; the consumers that filter to public posts apply the flag
// themselves where it matters.
export async function memberStatsByUser(
  userIds: string[],
): Promise<Record<string, MemberStats>> {
  if (userIds.length === 0) return {};

  const rows = await prisma.render.findMany({
    where: {
      userId: { in: userIds },
      trackedAt: { not: null },
      impressions: { gt: 0 },
    },
    select: {
      userId: true,
      trackedAt: true,
      impressions: true,
      reactions: true,
      comments: true,
      reposts: true,
    },
  });

  // Two accumulators per user: a running sum of impressions + a
  // running sum of (reactions+comments+reposts). avg engagement
  // = sum_engagement / sum_impressions — that's the impression-
  // weighted average, which matches what a member would compute by
  // hand. Mean-of-rates would over-weight low-reach posts.
  const out: Record<
    string,
    {
      postsShared: number;
      totalImpressions: number;
      totalEngagement: number;
      lastTrackedAt: Date | null;
    }
  > = {};

  for (const id of userIds) {
    out[id] = {
      postsShared: 0,
      totalImpressions: 0,
      totalEngagement: 0,
      lastTrackedAt: null,
    };
  }

  for (const r of rows) {
    const slot = out[r.userId];
    if (!slot) continue;
    slot.postsShared += 1;
    slot.totalImpressions += r.impressions ?? 0;
    slot.totalEngagement +=
      (r.reactions ?? 0) + (r.comments ?? 0) + (r.reposts ?? 0);
    if (
      r.trackedAt &&
      (!slot.lastTrackedAt || r.trackedAt > slot.lastTrackedAt)
    ) {
      slot.lastTrackedAt = r.trackedAt;
    }
  }

  const stats: Record<string, MemberStats> = {};
  for (const id of userIds) {
    const s = out[id];
    stats[id] = {
      postsShared: s.postsShared,
      totalImpressions: s.totalImpressions,
      avgEngagementRate:
        s.totalImpressions > 0 ? s.totalEngagement / s.totalImpressions : null,
      lastTrackedAt: s.lastTrackedAt,
    };
  }
  return stats;
}

// Convenience for the single-profile path.
export async function memberStats(userId: string): Promise<MemberStats> {
  const map = await memberStatsByUser([userId]);
  return (
    map[userId] ?? {
      postsShared: 0,
      totalImpressions: 0,
      avgEngagementRate: null,
      lastTrackedAt: null,
    }
  );
}
