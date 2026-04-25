"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function InviteRedeemForm({
  token,
  fixedEmail,
}: {
  token: string;
  fixedEmail: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not redeem invite.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        router.push("/auth/signin");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name (optional)" value={name} onChange={setName} autoComplete="name" />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
        readOnly={Boolean(fixedEmail)}
      />
      <Field
        label="Choose a password (min 8 chars)"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Claim invite"}
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
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
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
        readOnly={readOnly}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring read-only:bg-muted"
      />
    </label>
  );
}
