import { refreshUrl } from "@/lib/storage";

// Community-feed eligibility window. A post needs to be at least 7
// days past publishedAt with metrics logged in that window before
// it surfaces to the community — LinkedIn's algo dies off after
// ~a week, so earlier numbers are still climbing and would skew
// the wins leaderboard.
export const COMMUNITY_MATURITY_DAYS = 7;
const MATURITY_MS = COMMUNITY_MATURITY_DAYS * 24 * 60 * 60 * 1000;

// Render row + author shape returned by every feed endpoint. Keeps
// /wins, /posts team tab, and member cards consistent — same fields,
// same engagement_rate calculation, same URL refresh path.
export interface FeedPost {
  id: string;
  filename: string | null;
  url: string | null;
  format: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  trackedAt: Date | null;
  postUrl: string | null;
  postText: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  // (reactions + comments + reposts) / impressions, expressed as a
  // ratio (0.05 = 5%). Null when impressions is null or 0 — no
  // denominator means no rate. Calculated server-side so every
  // surface displays the same value.
  engagementRate: number | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

// Raw shape we get back from Prisma when we include the author
// relation. Kept narrow so changes to the User model don't bloat
// every feed payload.
export interface FeedRenderRow {
  id: string;
  filename: string | null;
  pngUrl: string | null;
  format: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  trackedAt: Date | null;
  postUrl: string | null;
  postText: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export function engagementRate(r: {
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
}): number | null {
  if (r.impressions === null || r.impressions <= 0) return null;
  const sum = (r.reactions ?? 0) + (r.comments ?? 0) + (r.reposts ?? 0);
  return sum / r.impressions;
}

// Cross-column predicate: trackedAt must be ≥ publishedAt + 7 days
// — i.e. the user came back at least a week after posting to log
// numbers. Prisma can't express column-arithmetic in a where clause
// so callers SQL-filter for the necessary precondition (publishedAt
// older than 7 days, trackedAt set) and run rows through this for
// the precise gate.
export function isCommunityMature(row: {
  publishedAt: Date | null;
  trackedAt: Date | null;
}): boolean {
  if (!row.publishedAt || !row.trackedAt) return false;
  return row.trackedAt.getTime() - row.publishedAt.getTime() >= MATURITY_MS;
}

// Necessary preconditions for community visibility. Apply at the
// SQL layer to shrink the candidate set; pair with isCommunityMature
// in JS to enforce the cross-column condition.
export function communityWhere() {
  const cutoff = new Date(Date.now() - MATURITY_MS);
  return {
    publishedAt: { not: null, lte: cutoff },
    trackedAt: { not: null },
  } as const;
}

// Refresh the rendered file URL through the storage proxy so a
// feed payload can be served straight to the browser. Authoring
// timestamps stay as Date objects — Next.js JSON-serializes them
// to ISO strings on the wire automatically.
export async function shapeFeedPost(row: FeedRenderRow): Promise<FeedPost> {
  return {
    id: row.id,
    filename: row.filename,
    url: row.pngUrl ? ((await refreshUrl(row.pngUrl)) ?? row.pngUrl) : null,
    format: row.format,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    trackedAt: row.trackedAt,
    postUrl: row.postUrl,
    postText: row.postText,
    impressions: row.impressions,
    reactions: row.reactions,
    comments: row.comments,
    reposts: row.reposts,
    engagementRate: engagementRate(row),
    author: {
      id: row.user.id,
      name: row.user.name,
      image: row.user.image,
    },
  };
}

// The select shape every feed query uses. Centralized so adding a
// field on Render or User just touches one place.
export const FEED_SELECT = {
  id: true,
  filename: true,
  pngUrl: true,
  format: true,
  createdAt: true,
  publishedAt: true,
  trackedAt: true,
  postUrl: true,
  postText: true,
  impressions: true,
  reactions: true,
  comments: true,
  reposts: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

// Period filter helper — `month` and `week` look at trackedAt
// (when the user last logged metrics) so a post tracked yesterday
// for the first time still appears in this week's feed even if it
// was rendered a year ago.
export function periodFilter(period: "all" | "month" | "week") {
  if (period === "all") return {};
  const ms = period === "week" ? 7 : 31;
  const since = new Date(Date.now() - ms * 24 * 60 * 60 * 1000);
  return { trackedAt: { gte: since } };
}
