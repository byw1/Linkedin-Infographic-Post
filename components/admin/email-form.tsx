"use client";

import { useState, useTransition } from "react";

export function EmailForm({
  initial,
  enabled,
}: {
  initial: { host: string; port: number; user: string; from: string };
  enabled: boolean;
}) {
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port || 587));
  const [user, setUser] = useState(initial.user);
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState(initial.from);
  const [testTo, setTestTo] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          host: host.trim(),
          port: Number(port),
          user: user.trim(),
          password,
          from: from.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      setMessage("Email settings saved.");
      setPassword("");
    });
  }

  function disable() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      if (res.ok) {
        setPassword("");
        setMessage("Email disabled.");
      }
    });
  }

  function test() {
    setMessage(null);
    setError(null);
    if (!testTo.trim()) {
      setError("Enter an address to send the test to.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/admin/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", to: testTo.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Test send failed.");
        return;
      }
      setMessage(`Test sent to ${testTo}.`);
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Email (SMTP)</div>
          <div className="text-xs text-muted-foreground">
            {enabled
              ? "Configured. Invites sent with an email address will be delivered."
              : "Not configured. Invites still create a link, just no email."}
          </div>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={disable}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary disabled:opacity-50"
          >
            Disable
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">SMTP host</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.resend.com"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Port</span>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            inputMode="numeric"
            placeholder="587"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Username</span>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="apikey or smtp username"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Password / API key</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={enabled ? "Enter to update" : ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">From address</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder='"viral" <invites@yourdomain.com>'
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            What recipients see in the From line. Include a display name in
            quotes for nicer mail-client rendering, e.g. <code>&quot;viral&quot; &lt;invites@yourdomain.com&gt;</code>.
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !host || !user || (!enabled && !password) || !from}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {enabled && (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            />
            <button
              type="button"
              onClick={test}
              disabled={pending || !testTo}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary disabled:opacity-50"
            >
              Send test
            </button>
          </div>
        )}
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
