"use client";

import { forwardRef } from "react";
import {
  BarChart2,
  BellOff,
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Upload,
} from "lucide-react";

// Single-tweet emulator. Rendered into a 1080×1350 dark canvas
// (LinkedIn 4:5 portrait dimensions) so the resulting PNG drops
// straight into a LinkedIn post. The card itself sits centered
// with breathing room so the "screenshot" feel reads.
//
// All counts can be hidden via the engagement.show* flags — the
// X UI always renders the row; we let users blank fields entirely
// for "fresh post" looks where impressions/likes haven't loaded.

export type CheckMark = "none" | "blue" | "gray" | "gold";

export interface TweetEngagement {
  replies: number | null;
  reposts: number | null;
  likes: number | null;
  bookmarks: number | null;
  impressions: number | null;
  showReplies: boolean;
  showReposts: boolean;
  showLikes: boolean;
  showBookmarks: boolean;
  showImpressions: boolean;
}

export interface TweetData {
  name: string;
  username: string;
  avatarUrl: string | null;
  checkmark: CheckMark;
  body: string;
  // Free-form "10h" / "3m" / "Apr 30" — we don't enforce a format
  // since it's purely cosmetic.
  timeAgo: string;
  engagement: TweetEngagement;
}

// Output canvas dimensions — LinkedIn 4:5 portrait, 1080 wide.
// Exposed so the export step can read them without re-deriving.
export const TWEET_CANVAS = { width: 1080, height: 1350 } as const;

interface Props {
  data: TweetData;
}

export const TweetPreview = forwardRef<HTMLDivElement, Props>(function TweetPreview(
  { data },
  ref,
) {
  const initials = displayInitial(data.name || data.username);

  return (
    <div
      ref={ref}
      // The wrapper is the actual capture target. Fixed pixel
      // dimensions so html-to-image grabs exactly 1080×1350. Any
      // visual down-scaling for the editor surface is handled by
      // the parent so the captured element stays at native size.
      className="relative flex flex-col items-center justify-center overflow-hidden bg-black"
      style={{
        width: TWEET_CANVAS.width,
        height: TWEET_CANVAS.height,
      }}
    >
      {/* Subtle backdrop gradient — mirrors the welcome page palette
        * so tweets feel native to the brand without overpowering. */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-violet-900/20" />

      {/* Tweet card. Width chosen so a typical post body wraps the
        * way it does in the X UI at default zoom. */}
      <article
        className="relative w-[860px] rounded-3xl bg-black px-10 py-9 text-white shadow-2xl ring-1 ring-white/10"
        style={{ fontFamily: '"Helvetica Neue", system-ui, sans-serif' }}
      >
        <header className="flex items-start gap-4">
          <Avatar
            src={data.avatarUrl}
            initials={initials}
            // Gold checkmarks emulate LinkedIn company pages, which
            // use squircle (rounded-square) logos rather than the
            // circular avatars personal accounts get. Anything else
            // (blue/gray/none) stays a circle.
            shape={data.checkmark === "gold" ? "squircle" : "circle"}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[26px] leading-tight">
              <span className="font-bold text-white">{data.name || "Display name"}</span>
              {data.checkmark !== "none" && <CheckBadge kind={data.checkmark} />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[22px] leading-tight text-[#71767b]">
              <span>@{(data.username || "username").replace(/^@/, "")}</span>
              <span>·</span>
              <span>{data.timeAgo || "1h"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[#71767b]">
            <BellOff size={22} aria-hidden />
            <MoreHorizontal size={26} aria-hidden />
          </div>
        </header>

        <p
          className="mt-5 whitespace-pre-wrap text-[28px] leading-snug text-white"
          // Tighter line-height looks more like the X feed at large
          // sizes; keeps long bodies from sprawling.
        >
          {data.body || "Your tweet body."}
        </p>

        <footer className="mt-7 flex items-center justify-between text-[#71767b]">
          <Metric
            icon={<MessageCircle size={26} aria-hidden />}
            value={data.engagement.replies}
            visible={data.engagement.showReplies}
          />
          <Metric
            icon={<Repeat2 size={28} aria-hidden />}
            value={data.engagement.reposts}
            visible={data.engagement.showReposts}
          />
          <Metric
            icon={<Heart size={26} aria-hidden />}
            value={data.engagement.likes}
            visible={data.engagement.showLikes}
          />
          <Metric
            icon={<BarChart2 size={26} aria-hidden />}
            value={data.engagement.impressions}
            visible={data.engagement.showImpressions}
          />
          <div className="flex items-center gap-2 text-[20px]">
            {data.engagement.showBookmarks && (
              <span className="flex items-center gap-1.5">
                <Bookmark size={24} aria-hidden />
                {data.engagement.bookmarks !== null
                  ? fmtCompact(data.engagement.bookmarks)
                  : ""}
              </span>
            )}
            <Upload size={24} aria-hidden />
          </div>
        </footer>
      </article>
    </div>
  );
});

function Avatar({
  src,
  initials,
  shape,
}: {
  src: string | null;
  initials: string;
  shape: "circle" | "squircle";
}) {
  // Tailwind's `rounded-full` for the personal/circle case;
  // `rounded-2xl` for the company squircle (matches LinkedIn's
  // company-page logo radius — soft enough to read as "shape" but
  // not so round it loses the squareness).
  const radius = shape === "squircle" ? "rounded-2xl" : "rounded-full";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        crossOrigin="anonymous"
        className={`h-[80px] w-[80px] shrink-0 border border-white/10 object-cover ${radius}`}
      />
    );
  }
  return (
    <div
      className={`flex h-[80px] w-[80px] shrink-0 items-center justify-center border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-600 text-[34px] font-semibold uppercase ${radius}`}
    >
      {initials}
    </div>
  );
}

function CheckBadge({ kind }: { kind: Exclude<CheckMark, "none"> }) {
  // X actually uses three colors:
  //   blue → individual verified
  //   gold → verified organizations / business
  //   gray → government / affiliated
  // Approximate the fill colors directly so the badge reads at a
  // glance whether or not the user has X's exact SVG memorized.
  const fill =
    kind === "blue" ? "#1d9bf0" : kind === "gold" ? "#e8a500" : "#5b7083";

  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 22 22"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill={fill}
        d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44-.541-.354-1.171-.551-1.817-.569-.646.018-1.276.215-1.817.57-.541.354-.972.853-1.245 1.44-.608-.223-1.264-.27-1.898-.14-.633.131-1.217.437-1.686.882-.445.47-.75 1.053-.882 1.687-.13.633-.083 1.29.14 1.897-.586.274-1.084.705-1.439 1.246-.354.541-.551 1.17-.569 1.816.018.647.215 1.276.57 1.817.354.54.852.972 1.438 1.245-.223.608-.27 1.264-.14 1.898.131.633.437 1.218.882 1.687.47.445 1.053.75 1.687.882.633.13 1.29.083 1.897-.14.273.586.704 1.084 1.245 1.439.541.354 1.17.551 1.817.569.647-.018 1.276-.215 1.817-.57.541-.354.972-.852 1.245-1.438.608.223 1.264.27 1.898.14.633-.131 1.218-.437 1.687-.882.445-.47.75-1.054.882-1.687.13-.634.083-1.29-.14-1.898.586-.273 1.084-.705 1.439-1.245.354-.541.551-1.17.569-1.817zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
      />
    </svg>
  );
}

function Metric({
  icon,
  value,
  visible,
}: {
  icon: React.ReactNode;
  value: number | null;
  visible: boolean;
}) {
  if (!visible) {
    // Render the icon alone (no count) so the row's spacing stays
    // consistent — same as a fresh X post that hasn't accrued any.
    return <span className="flex items-center gap-2 text-[20px]">{icon}</span>;
  }
  return (
    <span className="flex items-center gap-2 text-[20px]">
      {icon}
      {value !== null && fmtCompact(value)}
    </span>
  );
}

// Same compact format X uses ("1.2K", "17K", "1.4M"). Locale-default
// thousands separators on small numbers, single-decimal abbreviation
// past 1k.
function fmtCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

function displayInitial(s: string): string {
  const trimmed = s.trim().replace(/^@/, "");
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}
