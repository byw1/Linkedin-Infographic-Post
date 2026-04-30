"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  linkedin: string;
  industry: string;
  skills: string;
  referrer: string;
  status: "pending" | "approved" | "declined";
  createdAt: string;
  reviewedAt: string | null;
  inviteId: string | null;
  reviewedBy: { id: string; name: string | null; email: string } | null;
}

// Admin review surface for /welcome/request submissions. Pending
// requests get full action affordances; past ones collapse into a
// compact log so a long history doesn't clutter the queue.
export function AccessRequestsView() {
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [showPast, setShowPast] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/access-requests");
    if (!res.ok) return;
    const data = await res.json();
    setRequests(data.requests);
  }

  useEffect(() => {
    void load();
  }, []);

  const { pending, past } = useMemo(() => {
    if (!requests) return { pending: [] as AccessRequest[], past: [] as AccessRequest[] };
    const p: AccessRequest[] = [];
    const o: AccessRequest[] = [];
    for (const r of requests) {
      if (r.status === "pending") p.push(r);
      else o.push(r);
    }
    return { pending: p, past: o };
  }, [requests]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending
          </h3>
          <span className="text-xs text-muted-foreground">
            {pending.length} to review
          </span>
        </div>

        {requests === null && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {requests && pending.length === 0 && (
          <p className="rounded-md border border-dashed bg-card p-4 text-xs text-muted-foreground">
            No pending requests. New submissions from{" "}
            <code>/welcome/request</code> show up here.
          </p>
        )}
        {pending.map((r) => (
          <PendingRow key={r.id} request={r} onChange={() => void load()} />
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
            <span>Past decisions</span>
            <span className="text-[11px] font-normal lowercase tracking-normal text-muted-foreground/70">
              ({past.length} approved or declined)
            </span>
          </button>
          {showPast && (
            <div className="space-y-2">
              {past.map((r) => (
                <PastRow key={r.id} request={r} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function PendingRow({
  request: r,
  onChange,
}: {
  request: AccessRequest;
  onChange: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");

  function act(action: "approve" | "decline") {
    setError(null);
    setMessage(null);
    if (action === "decline") {
      if (!confirm(`Decline ${r.name}'s access request?`)) return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/access-requests/${r.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Failed.");
        return;
      }
      const data = await res.json();
      if (action === "approve") {
        if (data.already_member) {
          setMessage(`${r.email} is already a member — marked approved.`);
        } else if (data.email_error) {
          setMessage(
            `Invite created, but email failed: ${data.email_error}. Pull the link from /admin/invites.`,
          );
        } else if (data.emailed) {
          setMessage(`Approved. Invite emailed to ${r.email}.`);
        } else {
          setMessage(
            `Approved. Email isn't configured, so grab the link from /admin/invites.`,
          );
        }
      }
      onChange();
    });
  }

  const submitted = new Date(r.createdAt).toLocaleString();

  return (
    <div className="space-y-3 rounded-md border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-semibold">{r.name}</div>
          <a
            href={`mailto:${r.email}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {r.email}
          </a>
        </div>
        <span className="text-[11px] text-muted-foreground">
          submitted {submitted}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[80px_1fr]">
        <dt className="text-muted-foreground">LinkedIn</dt>
        <dd className="min-w-0 break-all">
          <a
            href={r.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {r.linkedin}
          </a>
        </dd>
        <dt className="text-muted-foreground">Industry</dt>
        <dd>{r.industry}</dd>
        <dt className="text-muted-foreground">Referrer</dt>
        <dd>{r.referrer}</dd>
        <dt className="text-muted-foreground">Skills</dt>
        <dd className="whitespace-pre-wrap">{r.skills}</dd>
      </dl>

      {showNote && (
        <label className="block text-xs">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
            Note for the invite email (optional)
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Personal line that goes in the invite email"
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => act("approve")}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Working..." : "Approve & send invite"}
        </button>
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="inline-flex h-9 items-center rounded-md border px-3 text-xs hover:bg-secondary"
        >
          {showNote ? "Hide note" : "Add note"}
        </button>
        <button
          type="button"
          onClick={() => act("decline")}
          disabled={pending}
          className="ml-auto inline-flex h-9 items-center rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          Decline
        </button>
      </div>

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PastRow({ request: r }: { request: AccessRequest }) {
  const reviewed = r.reviewedAt
    ? new Date(r.reviewedAt).toLocaleDateString()
    : null;
  const reviewer = r.reviewedBy
    ? r.reviewedBy.name ?? r.reviewedBy.email
    : "admin";
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{r.name}</span>
      <span>·</span>
      <span>{r.email}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
          r.status === "approved"
            ? "bg-primary/10 text-primary"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {r.status}
      </span>
      {reviewed && (
        <span>
          {r.status} by {reviewer} on {reviewed}
        </span>
      )}
    </div>
  );
}
