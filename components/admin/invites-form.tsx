"use client";

import { useEffect, useState, useTransition } from "react";

interface Invite {
  id: string;
  token: string;
  email: string | null;
  role: "user" | "admin";
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export function InvitesForm() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/invites");
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites);
    }
  }

  function create() {
    startTransition(async () => {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          role,
        }),
      });
      if (res.ok) {
        setEmail("");
        setRole("user");
        await load();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Email (optional — locks invite to this address)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Create invite
        </button>
      </div>

      <div className="space-y-2">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        )}
        {invites.map((inv) => {
          const url = `${origin}/invite/${inv.token}`;
          const expired = new Date(inv.expiresAt).getTime() < Date.now();
          return (
            <div key={inv.id} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{inv.email ?? "(any email)"}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">{inv.role}</span>
                {inv.usedAt ? (
                  <span className="text-xs text-muted-foreground">
                    used {new Date(inv.usedAt).toLocaleDateString()}
                  </span>
                ) : expired ? (
                  <span className="text-xs text-destructive">expired</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {!inv.usedAt && !expired && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    className="h-8 flex-1 rounded-md border border-input bg-muted px-2 font-mono text-xs"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(url)}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(inv.id)}
                    className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
                  >
                    Revoke
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
