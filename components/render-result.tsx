"use client";

import { useState, useTransition } from "react";
import {
  TrackForm,
  TrackingSummary,
  type Tracking,
} from "@/components/tracking/track-form";

export type ResultKind = "png" | "pdf" | "zip";

export type { Tracking };

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

