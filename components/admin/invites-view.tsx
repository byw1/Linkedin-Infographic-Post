"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

interface InviteUser {
  id: string;
  name: string | null;
  email: string;
}

interface Invite {
  id: string;
  token: string;
  email: string | null;
  role: "user" | "admin";
  note: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  usedBy: InviteUser | null;
}

// Top-level invites surface for /admin/invites. Two responsibilities:
//   1. Create a new invite (link or email).
//   2. List existing invites — but split into Active / Past so a
//      long history of redeemed invites doesn't bury the still-open
//      ones. Past collapses by default.
export function InvitesView({ emailReady }: { emailReady: boolean }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [origin, setOrigin] = useState("");
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/invites");
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites);
  }

  const { active, past } = useMemo(() => {
    if (!invites) return { active: [], past: [] };
    const now = Date.now();
    const a: Invite[] = [];
    const p: Invite[] = [];
    for (const inv of invites) {
      const expired = new Date(inv.expiresAt).getTime() < now;
      if (inv.usedAt || expired) p.push(inv);
      else a.push(inv);
    }
    return { active: a, past: p };
  }, [invites]);

  return (
    <div className="space-y-8">
      <CreateInviteForm
        emailReady={emailReady}
        onCreated={() => void load()}
      />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active invites
          </h3>
          <span className="text-xs text-muted-foreground">
            {active.length} pending
          </span>
        </div>
        {invites === null && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {invites && active.length === 0 && (
          <p className="rounded-md border border-dashed bg-card p-4 text-xs text-muted-foreground">
            No pending invites. Create one above and share the link.
          </p>
        )}
        {active.map((inv) => (
          <ActiveInviteRow
            key={inv.id}
            invite={inv}
            origin={origin}
            emailReady={emailReady}
            onChange={() => void load()}
          />
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <span>{showPast ? "▾" : "▸"}</span>
            <span>Past invites</span>
            <span className="text-[11px] font-normal lowercase tracking-normal text-muted-foreground/70">
              ({past.length} redeemed or expired)
            </span>
          </button>
          {showPast && (
            <div className="space-y-2">
              {past.map((inv) => (
                <PastInviteRow key={inv.id} invite={inv} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CreateInviteForm({
  emailReady,
  onCreated,
}: {
  emailReady: boolean;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [note, setNote] = useState("");
  // Send-by-email defaults on when both the SMTP creds are configured AND
  // the admin actually entered an email; falls back to "just create the
  // link" otherwise.
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function create() {
    setMessage(null);
    setError(null);
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
        setError(typeof data.error === "string" ? data.error : "Create failed.");
        return;
      }
      const data = await res.json();
      if (data.email_error) {
        setError(`Invite created, but email failed: ${data.email_error}`);
      } else if (data.emailed) {
        setMessage(`Invite emailed to ${email}.`);
      } else {
        setMessage("Invite created — copy the link from the list below.");
      }
      setEmail("");
      setNote("");
      setRole("user");
      onCreated();
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        New invite
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
          <span className="text-xs text-muted-foreground">
            Optional — locks the invite to this address. Required for email
            send.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            className="h-9 rounded-md border bg-background px-3 text-sm"
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
          className="h-9 rounded-md border bg-background px-3 text-sm"
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
            className="h-4 w-4 rounded border"
          />
          <span>
            Email the invite{" "}
            {!emailReady && (
              <Link
                href="/admin/email"
                className="text-muted-foreground underline"
              >
                (configure Email first)
              </Link>
            )}
          </span>
        </label>
        <button
          type="button"
          onClick={create}
          disabled={pending || (sendEmail && emailReady && !email)}
          className="ml-auto inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Creating..."
            : sendEmail && emailReady && email
              ? "Create & send"
              : "Create invite"}
        </button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ActiveInviteRow({
  invite,
  origin,
  emailReady,
  onChange,
}: {
  invite: Invite;
  origin: string;
  emailReady: boolean;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${origin}/invite/${invite.token}`;

  function copy() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function resend() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/invites/${invite.id}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Resend failed.");
        return;
      }
      setMessage(`Re-sent to ${invite.email}.`);
      onChange();
    });
  }

  function revoke() {
    if (!confirm("Revoke this invite? The link stops working immediately.")) {
      return;
    }
    startTransition(async () => {
      await fetch(`/api/admin/invites/${invite.id}`, { method: "DELETE" });
      onChange();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{invite.email ?? "(any email)"}</span>
        <span className="rounded bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {invite.role}
        </span>
        <span className="text-xs text-muted-foreground">
          expires {new Date(invite.expiresAt).toLocaleDateString()}
        </span>
      </div>
      {invite.note && (
        <p className="text-xs italic text-muted-foreground">“{invite.note}”</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          className="h-8 min-w-[14rem] flex-1 rounded-md border bg-muted px-2 font-mono text-[11px]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        {invite.email && emailReady && (
          <button
            type="button"
            onClick={resend}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-secondary disabled:opacity-50"
          >
            {pending ? "Sending..." : "Resend"}
          </button>
        )}
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PastInviteRow({ invite }: { invite: Invite }) {
  const used = invite.usedAt;
  const expired = !used && new Date(invite.expiresAt).getTime() < Date.now();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {invite.email ?? "(any email)"}
      </span>
      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
        {invite.role}
      </span>
      {used ? (
        <>
          <span className="text-foreground">
            joined {new Date(used).toLocaleDateString()}
          </span>
          {invite.usedBy && (
            <Link
              href={`/members/${invite.usedBy.id}`}
              className="text-primary hover:underline"
            >
              {invite.usedBy.name ?? invite.usedBy.email} →
            </Link>
          )}
        </>
      ) : expired ? (
        <span className="text-destructive">
          expired {new Date(invite.expiresAt).toLocaleDateString()}
        </span>
      ) : null}
    </div>
  );
}
