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

// Repost glyph — X uses a slightly thinner version of the standard
// repost arrow. Lucide's Repeat2 has the right shape; alias it for
// the reposted-by header so the import reads clearly there.
const RepostGlyph = Repeat2;

// Single-tweet emulator. Rendered into a 1080×1350 canvas (LinkedIn
// 4:5 portrait) so the resulting PNG drops straight into a LinkedIn
// post. The card sits centered with breathing room so the
// "screenshot" feel reads.
//
// Toggles match what people actually need:
//   - Hide any engagement metric → drops both the count AND the
//     icon (true hide, no orphan icon).
//   - Hide time / bell / more / share independently.
//   - Background presets (gradient, black, white, transparent).
//     "white" flips the card to X's light-mode palette so the colors
//     don't fight the backdrop.
//   - Border toggle removes the card's ring when you want it
//     bleeding into the backdrop.
//   - Font scale (sm/md/lg) multiplies every text size by 0.85 / 1
//     / 1.15. Avatar + icon sizes don't scale so the card layout
//     stays predictable across choices.

export type CheckMark = "none" | "blue" | "gray" | "gold";
export type Background =
  | "gradient"
  | "black"
  | "white"
  | "transparent"
  // Solid hex color from the user. The actual color lives on
  // `backgroundColor`. Lets people drop their brand color in
  // without filling out a whole theme.
  | "custom";
export type FontScale = "sm" | "md" | "lg";

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
  // Optional company affiliation. X shows a tiny rounded-square
  // logo immediately to the right of the verified checkmark for
  // some accounts ("affiliated with Acme"). Set the data-URL to
  // render it; null hides it. Renders next to any checkmark
  // colour, but it's most common alongside the blue badge.
  affiliationLogo: string | null;
  affiliationLabel: string;
  body: string;
  // Free-form "10h" / "3m" / "Apr 30" — empty string hides the
  // separator + time entirely.
  timeAgo: string;
  // Header icons — bell-off (notifications muted), three-dot menu.
  showBell: boolean;
  showMore: boolean;
  // Footer share/upload glyph (sits next to bookmarks).
  showShare: boolean;
  // Reposted-by attribution that sits above the card. Empty hides
  // the row. Gray text + repeat glyph, matching X's "Bob reposted"
  // header on amplified posts.
  repostedBy: string;
  // Visual style
  background: Background;
  // Hex color used when background === "custom". Ignored otherwise.
  backgroundColor: string;
  border: boolean;
  fontScale: FontScale;
  // Optional override for the body text size in pixels. Lets users
  // crank it up for "huge text" viral posts. When null the body
  // uses the default size scaled by fontScale.
  bodyFontSize: number | null;
  engagement: TweetEngagement;
}

// Output canvas dimensions — LinkedIn 4:5 portrait, 1080 wide.
export const TWEET_CANVAS = { width: 1080, height: 1350 } as const;

// Default field values — exported so TweetFlow can spin up new
// slides without re-stating the whole shape.
export const DEFAULT_TWEET: TweetData = {
  name: "Display name",
  username: "username",
  avatarUrl: null,
  checkmark: "blue",
  affiliationLogo: null,
  affiliationLabel: "",
  body: "Type your tweet here.",
  timeAgo: "10h",
  showBell: true,
  showMore: true,
  showShare: true,
  repostedBy: "",
  background: "gradient",
  backgroundColor: "#0a0a0f",
  border: true,
  fontScale: "md",
  bodyFontSize: null,
  engagement: {
    replies: 91,
    reposts: 3,
    likes: 172,
    bookmarks: 0,
    impressions: 17_000,
    showReplies: true,
    showReposts: true,
    showLikes: true,
    showBookmarks: false,
    showImpressions: true,
  },
};

interface Props {
  data: TweetData;
}

export const TweetPreview = forwardRef<HTMLDivElement, Props>(function TweetPreview(
  { data },
  ref,
) {
  const initials = displayInitial(data.name || data.username);

  // Font scale multiplier applied to every text style below.
  const fs =
    data.fontScale === "sm" ? 0.85 : data.fontScale === "lg" ? 1.15 : 1;

  // Light vs dark card. White background flips to X's light-mode
  // palette so text stays readable; everything else keeps the dark
  // card.
  const light = data.background === "white";
  const cardBg = light ? "bg-white" : "bg-black";
  const cardText = light ? "text-black" : "text-white";
  const mutedText = "text-[#71767b]"; // X's gray reads in both modes
  const ring = data.border
    ? light
      ? "ring-1 ring-black/10"
      : "ring-1 ring-white/10"
    : "";

  return (
    <div
      ref={ref}
      // The wrapper is the actual capture target. Fixed pixel
      // dimensions so html-to-image grabs exactly 1080×1350.
      className="relative flex flex-col items-center justify-center overflow-hidden"
      style={{
        width: TWEET_CANVAS.width,
        height: TWEET_CANVAS.height,
        // Background is layered below — keep this transparent so
        // "transparent" mode actually exports with alpha.
        backgroundColor:
          data.background === "transparent" ? "transparent" : "#000",
      }}
    >
      <Backdrop kind={data.background} customColor={data.backgroundColor} />

      {/* Card stack — the reposted-by header sits above the article
        * when present so the whole composition reads "Bob reposted"
        * → tweet card. Width matches the card so the header is left-
        * aligned with the avatar column. */}
      <div className="relative flex flex-col items-stretch">
        {data.repostedBy && (
          <div
            className={`mb-3 flex items-center gap-3 pl-[60px] ${mutedText}`}
            style={{ fontSize: 18 * fs }}
          >
            <RepostGlyph size={20} aria-hidden />
            <span>{data.repostedBy} reposted</span>
          </div>
        )}

        <article
          className={`relative w-[860px] rounded-3xl px-10 py-9 ${data.border ? "shadow-2xl" : ""} ${cardBg} ${cardText} ${ring}`}
          style={{ fontFamily: '"Helvetica Neue", system-ui, sans-serif' }}
        >
          <header className="flex items-start gap-4">
            <Avatar
              src={data.avatarUrl}
              initials={initials}
              // Gold checkmarks emulate LinkedIn company pages — those
              // use squircle (rounded-square) logos rather than the
              // circular avatars personal accounts get.
              shape={data.checkmark === "gold" ? "squircle" : "circle"}
            />
            <div className="min-w-0 flex-1">
              <div
                className="flex flex-wrap items-center gap-1.5 leading-tight"
                style={{ fontSize: 26 * fs }}
              >
                <span className={`font-bold ${cardText}`}>
                  {data.name || "Display name"}
                </span>
                {data.checkmark !== "none" && <CheckBadge kind={data.checkmark} />}
                {data.affiliationLogo && (
                  <AffiliationBadge
                    src={data.affiliationLogo}
                    label={data.affiliationLabel}
                  />
                )}
              </div>
            <div
              className={`flex flex-wrap items-center gap-1.5 leading-tight ${mutedText}`}
              style={{ fontSize: 22 * fs }}
            >
              <span>@{(data.username || "username").replace(/^@/, "")}</span>
              {data.timeAgo && (
                <>
                  <span>·</span>
                  <span>{data.timeAgo}</span>
                </>
              )}
            </div>
          </div>
          {(data.showBell || data.showMore) && (
            <div className={`flex items-center gap-3 ${mutedText}`}>
              {data.showBell && <BellOff size={22} aria-hidden />}
              {data.showMore && <MoreHorizontal size={26} aria-hidden />}
            </div>
          )}
        </header>

        <p
          className={`mt-5 whitespace-pre-wrap leading-snug ${cardText}`}
          // Body size honors an explicit override when set —
          // scaled fontSize otherwise. Big-text viral posts often
          // run 60-120px at this 1080×1350 canvas.
          style={{ fontSize: data.bodyFontSize ?? 28 * fs }}
        >
          {data.body || "Your tweet body."}
        </p>

        <Footer
          engagement={data.engagement}
          showShare={data.showShare}
          mutedClass={mutedText}
          fs={fs}
        />
      </article>
      </div>
    </div>
  );
});

function AffiliationBadge({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  // Tiny rounded-square logo to the right of the verified
  // checkmark. Sized to roughly match the badge so the row reads
  // as one visual unit.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={label}
      crossOrigin="anonymous"
      className="h-[28px] w-[28px] shrink-0 rounded-md object-cover"
    />
  );
}

function Backdrop({
  kind,
  customColor,
}: {
  kind: Background;
  customColor: string;
}) {
  // Each background is a single positioned div behind the card.
  // "transparent" returns null entirely so the canvas alpha shows
  // through in the captured PNG.
  if (kind === "transparent") return null;
  if (kind === "black") {
    return <div className="absolute inset-0 bg-black" />;
  }
  if (kind === "white") {
    return <div className="absolute inset-0 bg-white" />;
  }
  if (kind === "custom") {
    // Solid user-picked color. Inline-style since Tailwind can't
    // tokenize an arbitrary hex.
    return (
      <div className="absolute inset-0" style={{ backgroundColor: customColor }} />
    );
  }
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-black to-violet-900/20" />
  );
}

function Footer({
  engagement,
  showShare,
  mutedClass,
  fs,
}: {
  engagement: TweetEngagement;
  showShare: boolean;
  mutedClass: string;
  fs: number;
}) {
  // Build the metrics row from only the visible ones — true hide,
  // not orphan icons. Reposts/likes/replies/impressions are the
  // standard four; bookmarks + share live in a right cluster on X.
  const metrics: Array<{ key: string; icon: React.ReactNode; value: number | null }> = [];
  if (engagement.showReplies) {
    metrics.push({
      key: "replies",
      icon: <MessageCircle size={26} aria-hidden />,
      value: engagement.replies,
    });
  }
  if (engagement.showReposts) {
    metrics.push({
      key: "reposts",
      icon: <Repeat2 size={28} aria-hidden />,
      value: engagement.reposts,
    });
  }
  if (engagement.showLikes) {
    metrics.push({
      key: "likes",
      icon: <Heart size={26} aria-hidden />,
      value: engagement.likes,
    });
  }
  if (engagement.showImpressions) {
    metrics.push({
      key: "impressions",
      icon: <BarChart2 size={26} aria-hidden />,
      value: engagement.impressions,
    });
  }

  const hasRightCluster = engagement.showBookmarks || showShare;
  if (metrics.length === 0 && !hasRightCluster) return null;

  return (
    <footer
      className={`mt-7 flex items-center justify-between ${mutedClass}`}
      style={{ fontSize: 20 * fs }}
    >
      <div className="flex items-center gap-6">
        {metrics.map((m) => (
          <span key={m.key} className="flex items-center gap-2">
            {m.icon}
            {m.value !== null && fmtCompact(m.value)}
          </span>
        ))}
      </div>
      {hasRightCluster && (
        <div className="flex items-center gap-3">
          {engagement.showBookmarks && (
            <span className="flex items-center gap-1.5">
              <Bookmark size={24} aria-hidden />
              {engagement.bookmarks !== null && fmtCompact(engagement.bookmarks)}
            </span>
          )}
          {showShare && <Upload size={24} aria-hidden />}
        </div>
      )}
    </footer>
  );
}

function Avatar({
  src,
  initials,
  shape,
}: {
  src: string | null;
  initials: string;
  shape: "circle" | "squircle";
}) {
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
      className={`flex h-[80px] w-[80px] shrink-0 items-center justify-center border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-600 text-[34px] font-semibold uppercase text-white ${radius}`}
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
