"use client";

import { useState, useTransition } from "react";

export interface Tracking {
  post_url: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  tracked_at: string | null;
}

// Reusable inline tracking editor. Used by:
// - render-result.tsx (right after a render finishes)
// - posts-list.tsx PostCard (update stats from the archive)
// - external-post-form.tsx (initial fill on a manually-added post)
//
// The save handler is parent-supplied so the component doesn't care
// whether we're PATCH-ing /api/render/[id] or POST-ing a new
// external row — it just hands back the user input.
export function TrackForm({
  tracking,
  onSave,
  onCancel,
  saveLabel = "Save tracking",
}: {
  tracking: Tracking;
  onSave: (next: Partial<Tracking>) => Promise<void>;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [postUrl, setPostUrl] = useState(tracking.post_url ?? "");
  const [impressions, setImpressions] = useState(intInput(tracking.impressions));
  const [reactions, setReactions] = useState(intInput(tracking.reactions));
  const [comments, setComments] = useState(intInput(tracking.comments));
  const [reposts, setReposts] = useState(intInput(tracking.reposts));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await onSave({
          post_url: postUrl.trim() || null,
          impressions: parseIntOrNull(impressions),
          reactions: parseIntOrNull(reactions),
          comments: parseIntOrNull(comments),
          reposts: parseIntOrNull(reposts),
        });
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Tracking
      </div>
      <label className="block text-sm">
        <span className="block text-[11px] text-muted-foreground">Post URL</span>
        <input
          type="url"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          placeholder="https://www.linkedin.com/posts/..."
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <NumberField label="Impressions" value={impressions} onChange={setImpressions} />
        <NumberField label="Reactions" value={reactions} onChange={setReactions} />
        <NumberField label="Comments" value={comments} onChange={setComments} />
        <NumberField label="Reposts" value={reposts} onChange={setReposts} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Drop in whatever you have — leave anything you don&apos;t. Empty fields
        clear the previous value. You can come back any time to update as
        your post matures.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving..." : saveLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-md border px-4 text-xs hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function TrackingSummary({ tracking }: { tracking: Tracking }) {
  const updated = tracking.tracked_at
    ? new Date(tracking.tracked_at).toLocaleString()
    : null;
  return (
    <div className="space-y-2 rounded-md border p-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tracking
        </span>
        {updated && (
          <span className="text-[11px] text-muted-foreground">updated {updated}</span>
        )}
      </div>
      {tracking.post_url ? (
        <a
          href={tracking.post_url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs text-primary hover:underline"
        >
          {tracking.post_url}
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">No post URL yet.</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Impressions" value={tracking.impressions} />
        <Metric label="Reactions" value={tracking.reactions} />
        <Metric label="Comments" value={tracking.comments} />
        <Metric label="Reposts" value={tracking.reposts} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-base font-semibold tabular-nums">
        {value === null ? "—" : value.toLocaleString()}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="h-9 w-full rounded-md border bg-background px-2 text-sm tabular-nums"
      />
    </label>
  );
}

function intInput(n: number | null): string {
  return n === null || n === undefined ? "" : String(n);
}

function parseIntOrNull(raw: string): number | null {
  const cleaned = raw.replace(/[, ]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

// Friendly relative time: "Updated 2m ago", "Updated yesterday".
// Used on PostCard tiles where the full timestamp would be noisy.
export function trackingUpdatedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Updated just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `Updated ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Updated ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Updated yesterday";
  if (d < 7) return `Updated ${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `Updated ${w}w ago`;
  const mo = Math.floor(d / 30);
  return `Updated ${mo}mo ago`;
}
