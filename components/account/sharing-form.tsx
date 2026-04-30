"use client";

import { useState, useTransition } from "react";

interface Props {
  initialShareTracked: boolean;
}

// One-toggle form for "share my tracked posts with the community."
// Hides the user's tracking metrics from /wins, /posts → Community,
// and the slideshow on their member card when off. Doesn't affect
// the user's own /posts list — they still see their own work.
export function SharingForm({ initialShareTracked }: Props) {
  const [shareTracked, setShareTracked] = useState(initialShareTracked);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(next: boolean) {
    setMessage(null);
    setShareTracked(next);
    startTransition(async () => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share_tracked: next }),
      });
      if (!res.ok) {
        // Roll back on failure so the toggle reflects reality.
        setShareTracked(!next);
        setMessage("Save failed.");
        return;
      }
      setMessage(
        next ? "Visible to other members." : "Hidden from other members.",
      );
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={shareTracked}
          onChange={(e) => toggle(e.target.checked)}
          disabled={pending}
          className="mt-1 h-4 w-4"
        />
        <div className="flex-1">
          <div className="text-sm font-medium">
            Share my tracked posts with the community
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Posts you&apos;ve clicked <strong>Track</strong> on (filled in
            real LinkedIn impressions / reactions) appear on{" "}
            <strong>Wins</strong>, the <strong>Community</strong> tab on
            Posts, and the rail on your <strong>Members</strong> card.
            Untracked drafts are never shared. Your own <em>My posts</em>{" "}
            tab always shows everything regardless of this setting.
          </p>
        </div>
      </label>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
