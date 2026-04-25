"use client";

import { useState, useTransition } from "react";

export function ProfileForm({
  initialName,
  email,
  role,
}: {
  initialName: string;
  email: string;
  role: string;
}) {
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      setMessage(res.ok ? "Saved." : "Save failed.");
    });
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <Field label="Email" value={email} readOnly hint="Set when your account was created." />
      <Field label="Role" value={role} readOnly />
      <Field label="Name" value={name} onChange={setName} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || name.trim() === initialName.trim()}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className="h-9 rounded-md border bg-background px-3 text-sm read-only:bg-muted read-only:text-muted-foreground"
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
