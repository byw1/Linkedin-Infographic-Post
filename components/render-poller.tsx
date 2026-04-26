"use client";

import { useEffect, useState } from "react";

interface State {
  status: "pending" | "rendering" | "complete" | "failed";
  png_url: string | null;
  error_message: string | null;
}

export function RenderPoller({
  renderId,
  onReset,
}: {
  renderId: string;
  onReset: () => void;
}) {
  const [state, setState] = useState<State>({
    status: "pending",
    png_url: null,
    error_message: null,
  });

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await fetch(`/api/render/${renderId}`);
      if (!res.ok) return;
      const data = (await res.json()) as State;
      if (cancelled) return;
      setState(data);
      if (data.status === "complete" || data.status === "failed") return;
      setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [renderId]);

  return (
    <div className="space-y-4">
      {state.status === "pending" && (
        <div className="rounded-md border p-4 text-sm">
          Queued — waiting for the worker...
        </div>
      )}
      {state.status === "rendering" && (
        <div className="rounded-md border p-4 text-sm">
          Rendering in headless Chrome...
        </div>
      )}
      {state.status === "complete" && (
        <div className="rounded-md border p-4 text-sm">Done.</div>
      )}
      {state.status === "failed" && (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="text-sm font-medium text-destructive">Render failed</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-background p-2 text-xs text-destructive">
            {state.error_message ?? "No error message captured. Check the worker logs in Railway for details."}
          </pre>
          <p className="text-xs text-muted-foreground">
            Render IDs: <code>{renderId}</code>. Search Railway worker logs for{" "}
            <code>{renderId}</code> to find the full stack.
          </p>
        </div>
      )}

      {state.png_url && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.png_url} alt="rendered infographic" className="mx-auto max-w-full" />
          </div>
          <div className="flex gap-3">
            <a
              href={state.png_url}
              download
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Download PNG
            </a>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
            >
              Start another
            </button>
          </div>
        </div>
      )}

      {state.status === "failed" && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center rounded-md border px-5 text-sm font-medium hover:bg-secondary"
        >
          Start over
        </button>
      )}
    </div>
  );
}
