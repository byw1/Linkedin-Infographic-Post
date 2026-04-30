"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { MemberTopPosts } from "@/components/feed/member-top-posts";
import { SocialIcons } from "@/components/social-icons";

type SocialKey = "linkedin" | "twitter" | "github" | "instagram" | "website";
type SocialMap = Partial<Record<SocialKey, string>>;

interface MemberStats {
  postsShared: number;
  totalImpressions: number;
  avgEngagementRate: number | null;
  lastTrackedAt: string | null;
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "user" | "admin";
  tags: string[];
  bio: string | null;
  socials: SocialMap;
  createdAt: string;
  // Set on every authenticated request, throttled to ~5 minutes.
  // Null until a member has hit any authenticated route since the
  // column was added.
  lastSeenAt: string | null;
  // Soft-banned. Only ever true for admin viewers — the API filters
  // banned rows out of non-admin responses.
  banned: boolean;
  isSelf: boolean;
  shareTracked: boolean;
  stats: MemberStats;
}

type Sort = "name" | "impressions" | "engagement" | "recent" | "active";

const SORT_LABEL: Record<Sort, string> = {
  name: "Name (A→Z)",
  impressions: "Most impressions",
  engagement: "Avg engagement",
  recent: "Most recent post",
  active: "Recently active",
};

export function MembersGrid() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");

  async function load(tag: string | null) {
    const params = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    const res = await fetch(`/api/members${params}`);
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members);
    setViewerIsAdmin(Boolean(data.viewerIsAdmin));
  }

  useEffect(() => {
    void load(activeTag);
  }, [activeTag]);

  const allTags = useMemo(() => {
    if (!members) return [];
    const set = new Map<string, number>();
    for (const m of members) {
      for (const t of m.tags) set.set(t, (set.get(t) ?? 0) + 1);
    }
    return Array.from(set.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [members]);

  // Filter + sort happen client-side. Search matches name, email
  // local-part, bio, and tags — covers the four ways someone might
  // recall a teammate. Sort uses the stats payload from /api/members
  // so "most impressions / avg engagement / recent" are first-class
  // without a server-side index.
  const visible = useMemo(() => {
    if (!members) return null;
    const q = search.trim().toLowerCase();
    let out = members;
    if (q) {
      out = out.filter((m) => {
        const name = (m.name ?? "").toLowerCase();
        const emailLocal = m.email.split("@")[0]?.toLowerCase() ?? "";
        const bio = (m.bio ?? "").toLowerCase();
        if (name.includes(q) || emailLocal.includes(q) || bio.includes(q)) {
          return true;
        }
        for (const t of m.tags) if (t.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    const sorted = [...out];
    switch (sort) {
      case "impressions":
        sorted.sort(
          (a, b) => b.stats.totalImpressions - a.stats.totalImpressions,
        );
        break;
      case "engagement":
        sorted.sort(
          (a, b) =>
            (b.stats.avgEngagementRate ?? -1) -
            (a.stats.avgEngagementRate ?? -1),
        );
        break;
      case "recent":
        sorted.sort((a, b) => {
          const at = a.stats.lastTrackedAt
            ? new Date(a.stats.lastTrackedAt).getTime()
            : 0;
          const bt = b.stats.lastTrackedAt
            ? new Date(b.stats.lastTrackedAt).getTime()
            : 0;
          return bt - at;
        });
        break;
      case "active":
        sorted.sort((a, b) => {
          const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
          const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
          return bt - at;
        });
        break;
      case "name":
      default:
        sorted.sort((a, b) => {
          const an = (a.name ?? a.email).toLowerCase();
          const bn = (b.name ?? b.email).toLowerCase();
          return an.localeCompare(bn);
        });
    }
    return sorted;
  }, [members, search, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, bio, tag…"
          className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Sort members"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
        {visible && members && (
          <span className="text-xs text-muted-foreground">
            {visible.length === members.length
              ? `${members.length} member${members.length === 1 ? "" : "s"}`
              : `${visible.length} of ${members.length}`}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTag(null)}
          className={`inline-flex h-7 items-center rounded-full border px-3 text-xs ${
            activeTag === null
              ? "border-primary bg-primary/10 text-primary-foreground"
              : "hover:bg-secondary"
          }`}
        >
          All
        </button>
        {allTags.map(([t, n]) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTag(t === activeTag ? null : t)}
            className={`inline-flex h-7 items-center gap-1 rounded-full border px-3 font-mono text-xs ${
              t === activeTag
                ? "border-primary bg-primary/10 text-foreground"
                : "hover:bg-secondary"
            }`}
          >
            {t}
            <span className="text-muted-foreground">{n}</span>
          </button>
        ))}
      </div>

      {visible === null && <p className="text-sm text-muted-foreground">Loading...</p>}
      {visible && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? `No matches for "${search.trim()}".`
            : activeTag
              ? `No members tagged ${activeTag} yet.`
              : "No members yet."}
        </p>
      )}
      {visible && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              viewerIsAdmin={viewerIsAdmin}
              onChanged={() => void load(activeTag)}
              onTagClick={(t) => setActiveTag(t === activeTag ? null : t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  viewerIsAdmin,
  onChanged,
  onTagClick,
}: {
  member: Member;
  viewerIsAdmin: boolean;
  onChanged: () => void;
  onTagClick: (t: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Admin actions hit /api/admin/members/[id]. Banning is reversible
  // (toggles bannedAt). Remove is hard-delete and cascades through
  // owned content (renders, themes, hide overrides) per the schema.
  function ban(banned: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/members/${member.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      onChanged();
    });
  }

  function remove() {
    if (
      !confirm(
        `Permanently remove ${member.name ?? member.email}? This deletes their account, renders, themes, and uploads. Cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      onChanged();
    });
  }

  return (
    <div
      className={`space-y-3 rounded-md border p-4 ${
        member.banned ? "border-destructive/40 bg-destructive/5" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <a href={`/members/${member.id}`} className="shrink-0">
          <Avatar member={member} />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <a
              href={`/members/${member.id}`}
              className="truncate text-sm font-semibold hover:underline"
            >
              {member.name ?? member.email.split("@")[0]}
            </a>
            {member.role === "admin" && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                admin
              </span>
            )}
            {member.isSelf && (
              <span className="text-[10px] uppercase tracking-wide text-primary">
                you
              </span>
            )}
            {member.banned && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                banned
              </span>
            )}
          </div>
          <a
            href={`mailto:${member.email}`}
            className="block truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {member.email}
          </a>
          <p className="text-[11px] text-muted-foreground">
            {lastSeenLabel(member.lastSeenAt)}
          </p>
        </div>
        {member.isSelf && (
          <a
            href="/settings/profile"
            className="inline-flex h-7 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Edit
          </a>
        )}
      </div>

      {member.bio && (
        <p className="text-sm text-muted-foreground">{member.bio}</p>
      )}
      <MemberStatsLine
        stats={member.stats}
        shareTracked={member.shareTracked}
        isSelf={member.isSelf}
      />
      {member.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {member.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTagClick(t)}
              className="inline-flex h-6 items-center rounded-full border bg-secondary/50 px-2 font-mono text-[11px] hover:bg-secondary"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {Object.keys(member.socials).length > 0 && (
        <SocialIcons socials={member.socials} />
      )}
      {viewerIsAdmin && !member.isSelf && (
        // Admin moderation row. "Edit" jumps to the member's profile
        // page where the admin sees the inline editor; ban / remove
        // are inline so the directory is one click away from full
        // moderation.
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Admin
          </span>
          <a
            href={`/members/${member.id}#admin-edit`}
            className="inline-flex h-7 items-center rounded-md border px-2 hover:bg-secondary"
          >
            Edit profile
          </a>
          <button
            type="button"
            onClick={() => ban(!member.banned)}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border px-2 hover:bg-secondary disabled:opacity-50"
          >
            {member.banned ? "Unban" : "Ban"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            Remove
          </button>
          {error && <span className="text-destructive">{error}</span>}
        </div>
      )}

      <MemberTopPosts memberId={member.id} />
    </div>
  );
}

function initialsFor(member: Pick<Member, "name" | "email">): string {
  return (member.name ?? member.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ member }: { member: Member }) {
  const initials = initialsFor(member);
  if (member.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={member.image}
        alt={member.name ?? member.email}
        className="h-12 w-12 rounded-full border object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-secondary text-sm font-medium text-muted-foreground">
      {initials || "?"}
    </div>
  );
}

// Stats line under the bio: posts shared · cumulative impressions ·
// avg engagement · last post N days ago. Hidden when the member has
// shareTracked off (unless it's their own card — they always see
// their own numbers) or has nothing tracked yet. Avg engagement rate
// is the impression-weighted mean computed server-side.
function MemberStatsLine({
  stats,
  shareTracked,
  isSelf,
}: {
  stats: MemberStats;
  shareTracked: boolean;
  isSelf: boolean;
}) {
  if (!shareTracked && !isSelf) return null;
  if (stats.postsShared === 0) return null;

  const days = daysSince(stats.lastTrackedAt);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
      <span>
        <strong className="font-semibold text-foreground">
          {stats.postsShared}
        </strong>{" "}
        post{stats.postsShared === 1 ? "" : "s"}
      </span>
      <span>
        <strong className="font-mono font-semibold text-foreground tabular-nums">
          {fmtCount(stats.totalImpressions)}
        </strong>{" "}
        impressions
      </span>
      {stats.avgEngagementRate !== null && (
        <span>
          <strong className="font-mono font-semibold text-foreground tabular-nums">
            {(stats.avgEngagementRate * 100).toFixed(1)}%
          </strong>{" "}
          avg engagement
        </span>
      )}
      {days !== null && (
        <span>
          {days === 0
            ? "tracked today"
            : days === 1
              ? "1 day ago"
              : `${days} days ago`}
        </span>
      )}
      {!shareTracked && isSelf && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          (only you see this)
        </span>
      )}
    </div>
  );
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

// "Active 12m ago" / "Active 2h ago" / "Active yesterday" / "Active
// 3d ago" / "Active 2w ago" / "Active never". Uses lastSeenAt which
// the server bumps on every authenticated request (5-minute throttle
// — see lib/auth.ts:LAST_SEEN_BUMP_MS).
function lastSeenLabel(iso: string | null): string {
  if (!iso) return "Never seen";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Active just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `Active ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Active ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Active yesterday";
  if (d < 7) return `Active ${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `Active ${w}w ago`;
  const mo = Math.floor(d / 30);
  return `Active ${mo}mo ago`;
}
