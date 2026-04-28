"use client";

import { useState, useTransition } from "react";

export function PasswordForm() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Couldn't change password.");
        return;
      }
      setSuccess("Password changed.");
      setCurrent("");
      setNew("");
      setConfirm("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
      <Field
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={setCurrent}
        autoComplete="current-password"
        required
      />
      <Field
        label="New password (min 8 chars)"
        type="password"
        value={newPassword}
        onChange={setNew}
        autoComplete="new-password"
        required
      />
      <Field
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-400">{success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Change password"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      />
    </label>
  );
}
