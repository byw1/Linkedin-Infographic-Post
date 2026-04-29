"use client";

import { useState, useTransition } from "react";

export type ResultKind = "png" | "pdf" | "zip";

export interface Tracking {
  post_url: string | null;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  tracked_at: string | null;
}

interface Props {
  renderId: string;
  url: string;
  kind?: ResultKind;
  initialTracking?: Tracking;
  onReset: () => void;
}

const KIND_META: Record<ResultKind, { label: string; download: string }> = {
  png: { label: "PNG", download: "Download PNG" },
  pdf: { label: "PDF", download: "Download PDF" },
  zip: { label: "ZIP", download: "Download ZIP" },
};

export function RenderResult({
  renderId,
  url,
  kind = "png",
  initialTracking,
  onReset,
}: Props) {
  const [tracking, setTracking] = useState<Tracking>(
    initialTracking ?? {
      post_url: null,
      impressions: null,
      reactions: null,
      comments: null,
      reposts: null,
      tracked_at: null,
    },
  );
  const [editingTrack, setEditingTrack] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = KIND_META[kind];
  const tracked = tracking.tracked_at !== null;

  function deleteRender() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/render/${renderId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Delete failed.");
        return;
      }
      setDeleted(true);
    });
  }

  async function saveTracking(next: Partial<Tracking>) {
    setError(null);
    const body: Record<string, unknown> = {};
    if (next.post_url !== undefined) body.post_url = next.post_url || null;
    if (next.impressions !== undefined) body.impressions = next.impressions;
    if (next.reactions !== undefined) body.reactions = next.reactions;
    if (next.comments !== undefined) body.comments = next.comments;
    if (next.reposts !== undefined) body.reposts = next.reposts;
    const res = await fetch(`/api/render/${renderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data.error === "string" ? data.error : "Save failed.");
    }
    const data = await res.json();
    setTracking(data.tracking);
    setEditingTrack(false);
  }

  if (deleted) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border p-4 text-sm">Deleted.</div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          New
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 text-sm">Done.</div>

      {kind === "pdf" ? (
        <object
          data={url}
          type="application/pdf"
          className="block h-[600px] w-full rounded-md border bg-muted"
        >
          <p className="p-4 text-sm text-muted-foreground">
            PDF preview not supported here.{" "}
            <a href={url} className="underline" target="_blank" rel="noreferrer">
              Open in a new tab
            </a>
            .
          </p>
        </object>
      ) : kind === "zip" ? (
        <div className="rounded-md border bg-muted p-4 text-sm text-muted-foreground">
          Zip is ready — open it after downloading to find one PNG per slide,
          ready to upload to Instagram or post anywhere else.
        </div>
      ) : (
        <div className="rounded-md border bg-muted p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="rendered infographic" className="mx-auto max-w-full" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          download
          className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {meta.download}
        </a>
        <button
          type="button"
          onClick={() => setEditingTrack((v) => !v)}
          className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
        >
          {tracked ? "Edit tracking" : "Track"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="inline-flex h-10 items-center rounded-md border border-destructive/40 px-5 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
        >
          New
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {editingTrack && (
        <TrackForm
          tracking={tracking}
          onSave={saveTracking}
          onCancel={() => {
            setError(null);
            setEditingTrack(false);
          }}
        />
      )}

      {!editingTrack && tracked && <TrackingSummary tracking={tracking} />}

      {confirmingDelete && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">
            Delete this render? The {meta.label} file is removed from storage and the
            tracking row is gone too. Can&apos;t be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={deleteRender}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground disabled:opacity-50"
            >
              {pending ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackForm({
  tracking,
  onSave,
  onCancel,
}: {
  tracking: Tracking;
  onSave: (next: Partial<Tracking>) => Promise<void>;
  onCancel: () => void;
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
        clear the previous value.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save tracking"}
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

function TrackingSummary({ tracking }: { tracking: Tracking }) {
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
