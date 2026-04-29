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

export function InvitesForm({ emailReady }: { emailReady: boolean }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [note, setNote] = useState("");
  // Send-by-email defaults on when both the SMTP creds are configured AND
  // the admin actually entered an email; falls back to "just create the
  // link" otherwise.
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

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
    setCreateMessage(null);
    setCreateError(null);
    const wantsEmail = Boolean(emailReady && sendEmail && email);
    startTransition(async () => {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          role,
          note: note.trim() || undefined,
          send_email: wantsEmail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(typeof data.error === "string" ? data.error : "Create failed.");
        return;
      }
      const data = await res.json();
      if (data.email_error) {
        setCreateError(`Invite created, but email failed: ${data.email_error}`);
      } else if (data.emailed) {
        setCreateMessage(`Invite emailed to ${email}.`);
      } else {
        setCreateMessage("Invite created — copy the link below.");
      }
      setEmail("");
      setNote("");
      setRole("user");
      await load();
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
      <div className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              Optional — locks the invite to this address. Required if you want
              to send by email.
            </span>
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
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Hey, signing you up for the carousel tool — talk soon."
            maxLength={200}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            Shown to the recipient inside the invite email.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail && emailReady}
              disabled={!emailReady}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span>
              Email the invite{" "}
              {!emailReady && (
                <span className="text-muted-foreground">
                  (configure Email below first)
                </span>
              )}
            </span>
          </label>
          <button
            type="button"
            onClick={create}
            disabled={pending || (sendEmail && emailReady && !email)}
            className="ml-auto inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating..." : sendEmail && emailReady && email ? "Create & send" : "Create invite"}
          </button>
        </div>
        {createMessage && <p className="text-xs text-muted-foreground">{createMessage}</p>}
        {createError && <p className="text-xs text-destructive">{createError}</p>}
      </div>

      <div className="space-y-2">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        )}
        {invites.map((inv) => (
          <InviteRow
            key={inv.id}
            invite={inv}
            origin={origin}
            emailReady={emailReady}
            onRemove={() => remove(inv.id)}
            onChange={() => void load()}
          />
        ))}
      </div>
    </div>
  );
}

function InviteRow({
  invite,
  origin,
  emailReady,
  onRemove,
  onChange,
}: {
  invite: Invite;
  origin: string;
  emailReady: boolean;
  onRemove: () => void;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = `${origin}/invite/${invite.token}`;
  const expired = new Date(invite.expiresAt).getTime() < Date.now();

  function resend() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/invites/${invite.id}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Resend failed.");
        return;
      }
      setMessage(`Re-sent to ${invite.email}.`);
      onChange();
    });
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{invite.email ?? "(any email)"}</span>
        <span className="rounded bg-secondary px-2 py-0.5 text-xs">{invite.role}</span>
        {invite.usedAt ? (
          <span className="text-xs text-muted-foreground">
            used {new Date(invite.usedAt).toLocaleDateString()}
          </span>
        ) : expired ? (
          <span className="text-xs text-destructive">expired</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            expires {new Date(invite.expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {invite.note && (
        <p className="mt-1 text-xs text-muted-foreground">“{invite.note}”</p>
      )}
      {!invite.usedAt && !expired && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={url}
            className="h-8 flex-1 min-w-[14rem] rounded-md border border-input bg-muted px-2 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(url)}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Copy
          </button>
          {invite.email && emailReady && (
            <button
              type="button"
              onClick={resend}
              disabled={pending}
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary disabled:opacity-50"
            >
              {pending ? "Sending..." : "Resend email"}
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
          >
            Revoke
          </button>
        </div>
      )}
      {message && <p className="mt-1 text-xs text-muted-foreground">{message}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
