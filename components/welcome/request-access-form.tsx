"use client";

import { useState, useTransition } from "react";

// Public access-request form. Posts to /api/access-request which
// emails every admin with the applicant's details. The endpoint
// also handles bot-light filtering (honeypot field below). We don't
// store the row anywhere — admins decide whether to invite via the
// /admin/invites flow, which becomes the auth-creating side.
export function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [industry, setIndustry] = useState("");
  const [skills, setSkills] = useState("");
  const [referrer, setReferrer] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Honeypot — real users leave this blank. Bots fill every field
  // they see. The server rejects any submission with content here.
  const [hp, setHp] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    setError(null);
    if (!agreed) {
      setError("Please confirm you'll keep posting once you're in.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          linkedin: linkedin.trim(),
          industry: industry.trim(),
          skills: skills.trim(),
          referrer: referrer.trim(),
          hp,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof data.error === "string" ? data.error : "Submit failed.",
        );
        return;
      }
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <div className="space-y-3 border bg-card p-6 text-card-foreground">
        <h2 className="text-xl font-semibold">
          Got it. We&apos;ll be in touch.
        </h2>
        <p className="text-sm text-muted-foreground">
          Your request is on its way to the team. If you&apos;re a fit,
          you&apos;ll get an invite link by email — usually within a few days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 border p-6">
      <Field
        label="Your name"
        value={name}
        onChange={setName}
        placeholder="Jane Doe"
        required
      />
      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="jane@company.com"
        hint="We'll send your invite here."
        required
      />
      <Field
        label="LinkedIn URL"
        value={linkedin}
        onChange={setLinkedin}
        type="url"
        placeholder="https://www.linkedin.com/in/your-handle"
        required
      />
      <Field
        label="Industry"
        value={industry}
        onChange={setIndustry}
        placeholder="B2B SaaS, fintech, design tooling, …"
        required
      />
      <Field
        label="Skills + niche"
        value={skills}
        onChange={setSkills}
        placeholder="Growth marketing, design systems, devrel, founder-led content, …"
        textarea
        required
      />
      <Field
        label="Who referred you?"
        value={referrer}
        onChange={setReferrer}
        placeholder="Friend's name (or LinkedIn handle)"
        hint="Membership is referral-based. Tell us who sent you."
        required
      />

      {/* Honeypot — invisible to humans, irresistible to bots. The
       * server rejects any submission where this field is non-empty. */}
      <div aria-hidden className="sr-only">
        <label>
          Leave this empty
          <input
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 border bg-muted/40 p-3 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="font-medium">I&apos;ll show up and post.</span>{" "}
          <span className="text-muted-foreground">
            Members who go quiet for an extended stretch get removed — we keep
            this group active on purpose.
          </span>
        </span>
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex h-10 items-center bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer outline-none focus-visible:border-ring"
      >
        {pending ? "Sending..." : "Submit request"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  required,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          required={required}
          className="border bg-background px-3 py-2 text-sm"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-10 border bg-background px-3 text-sm outline-none focus-visible:border-ring"
        />
      )}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
