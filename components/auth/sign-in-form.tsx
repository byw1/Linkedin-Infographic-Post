"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-background px-2">or</span>
            <div className="absolute left-0 right-0 top-1/2 -z-10 border-t" />
          </div>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="inline-flex h-10 w-full items-center justify-center rounded-md border text-sm font-medium hover:bg-secondary"
          >
            Continue with Google
          </button>
        </>
      )}
    </div>
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
        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
