"use client";

import { useState, useTransition } from "react";

export function AllowlistForm({ initial }: { initial: string[] }) {
  const [text, setText] = useState(initial.join("\n"));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    const emails = text
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/allowlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      setMessage(res.ok ? `Saved ${emails.length} email(s).` : "Save failed.");
    });
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        spellCheck={false}
        placeholder="alice@example.com&#10;bob@example.com"
        className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save allowlist"}
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}
