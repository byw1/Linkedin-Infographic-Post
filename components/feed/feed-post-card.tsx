"use client";

import Link from "next/link";

export interface FeedPost {
  id: string;
  filename: string | null;
  url: string | null;
  format: string | null;
  createdAt: string;
  trackedAt: string | null;
  postUrl: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  engagementRate: number | null;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Props {
  post: FeedPost;
  // When true the card includes an "Open in LinkedIn" button if the
  // author logged a post URL. /wins + Community feed both want this;
  // the member-card slideshow can keep it off to stay compact.
  showLinkedInLink?: boolean;
}

// Card shown on /posts → Community (Recent + Top). Hero is the
// rendered image (or a PDF placeholder for carousels, or an
// "external · LinkedIn" placeholder when the author logged a post
// they made elsewhere). Tracking row pairs the absolute counts with
// the engagement rate so the reader sees both reach and quality at
// a glance.
export function FeedPostCard({ post, showLinkedInLink = true }: Props) {
  const isPdf = post.format === "carousel";
  const isExternal = post.format === "external";
  const author = post.author.name ?? "Member";
  const dateStr = post.trackedAt
    ? new Date(post.trackedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  const title = post.filename;

  return (
    <div className="overflow-hidden rounded-lg border bg-card text-card-foreground">
      <div className="aspect-[4/5] bg-muted">
        {isExternal ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
            <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium uppercase tracking-wide">
              External · LinkedIn
            </span>
            {title && (
              <p className="line-clamp-4 text-sm font-medium text-foreground">
                {title}
              </p>
            )}
          </div>
        ) : post.url && !isPdf ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.url}
            alt={title ?? "post"}
            className="h-full w-full object-cover"
          />
        ) : isPdf ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-primary">
              Carousel · PDF
            </span>
            {post.url && (
              <a
                href={post.url}
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
            No preview
          </div>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2 text-xs">
          {post.author.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.author.image}
              alt={author}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium uppercase">
              {author.charAt(0)}
            </span>
          )}
          <Link
            href={`/members/${post.author.id}`}
            className="truncate font-medium hover:underline"
          >
            {author}
          </Link>
          {dateStr && <span className="text-muted-foreground">· {dateStr}</span>}
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
          <Stat label="Impressions" value={fmtCount(post.impressions)} />
          <Stat label="Engagement" value={fmtRate(post.engagementRate)} />
          <Stat label="Reactions" value={fmtCount(post.reactions)} />
          <Stat label="Comments" value={fmtCount(post.comments)} />
        </div>

        {showLinkedInLink && post.postUrl && (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] hover:bg-secondary"
          >
            Open on LinkedIn ↗
          </a>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function fmtCount(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtRate(r: number | null): string {
  if (r === null || r === undefined) return "—";
  return `${(r * 100).toFixed(1)}%`;
}
