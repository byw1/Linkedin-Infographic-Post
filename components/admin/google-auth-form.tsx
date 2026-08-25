"use client";

import { useState, useTransition } from "react";

export function GoogleAuthForm({
  initialClientId,
  enabled,
}: {
  initialClientId: string;
  enabled: boolean;
}) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/auth-providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-google", clientId, clientSecret }),
      });
      setMessage(res.ok ? "Google sign-in enabled." : "Save failed.");
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/auth-providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable-google" }),
      });
      if (res.ok) {
        setClientSecret("");
        setMessage("Google sign-in disabled.");
      }
    });
  }

  return (
    <div className="space-y-3 border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Google OAuth</div>
          <div className="text-xs text-muted-foreground">
            {enabled ? "Currently enabled." : "Not configured."}
          </div>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={disable}
            disabled={pending}
            className="inline-flex h-8 items-center border px-3 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
          >
            Disable
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Client ID</span>
          <input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-9 border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Client Secret</span>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={enabled ? "Enter to update" : ""}
            className="h-9 border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Add your callback URL in Google Cloud Console:{" "}
        <code className="bg-muted px-1">
          {"<your-domain>"}/api/auth/callback/google
        </code>
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !clientId || !clientSecret}
          className="inline-flex h-9 items-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {message && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
    </div>
  );
}
