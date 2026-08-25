"use client";

import { useEffect, useRef, useState } from "react";

type Status = "pending" | "rendering" | "complete" | "failed";

export interface PollerResult {
  status: Status;
  url: string | null;
  errorMessage: string | null;
}

interface Props {
  renderId: string;
  onComplete: (url: string) => void;
  onFailed: (message: string) => void;
  onCancel: () => void;
  // Hint shown above the spinner. The poller doesn't know how long the
  // job will take, so the parent provides context (e.g. slide count).
  message?: string;
}

// Polls /api/render/<id> on a fixed cadence and triggers callbacks when
// the job lands in a terminal state. Stops polling after 10 minutes —
// at which point something has clearly gone wrong upstream.
export function RenderPoller({
  renderId,
  onComplete,
  onFailed,
  onCancel,
  message,
}: Props) {
  const [status, setStatus] = useState<Status>("pending");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    const tick = setInterval(() => {
      if (!cancelled) setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const giveUpAt = Date.now() + 10 * 60 * 1000;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/render/${renderId}`);
        if (!res.ok) {
          if (Date.now() > giveUpAt) {
            onFailed(`Render didn't finish (${res.status}).`);
            return;
          }
          timer = setTimeout(poll, 2000);
          return;
        }
        const data = (await res.json()) as {
          status: Status;
          url: string | null;
          error_message: string | null;
        };
        if (cancelled) return;
        setStatus(data.status);
        if (data.status === "complete" && data.url) {
          onComplete(data.url);
          return;
        }
        if (data.status === "failed") {
          onFailed(data.error_message ?? "Render failed.");
          return;
        }
        if (Date.now() > giveUpAt) {
          onFailed("Render took too long (10 min).");
          return;
        }
        timer = setTimeout(poll, 2000);
      } catch (err) {
        if (cancelled) return;
        if (Date.now() > giveUpAt) {
          onFailed((err as Error).message);
          return;
        }
        timer = setTimeout(poll, 2000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [renderId, onComplete, onFailed]);

  const seconds = Math.floor(elapsedMs / 1000);
  return (
    <div className="space-y-4">
      <div className="border p-6 text-sm">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="font-medium text-foreground">
            {status === "pending"
              ? "Queued — waiting for the worker…"
              : "Rendering…"}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {seconds}s
          </span>
        </div>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        <div className="mt-3 h-1.5 w-full overflow-hidden bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex h-9 items-center border px-4 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer outline-none focus-visible:border-ring"
      >
        Cancel
      </button>
    </div>
  );
}
