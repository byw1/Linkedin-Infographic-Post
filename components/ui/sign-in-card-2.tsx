"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Asterisk } from "@/components/ui/asterisk";
import { Button } from "@/components/ui/button";
import { Field, FieldHint, Input, Label } from "@/components/ui/input";

interface Props {
  googleEnabled?: boolean;
}

/**
 * Sign in.
 *
 * This was 629 lines of glassmorphism — a 3D cursor-tracked card tilt,
 * four blurred drifting orbs, an SVG noise overlay, layered gradients,
 * and a shared-layout input highlight. Every one of those is something
 * the brand rules out, so the component is structure now: hairlines, a
 * single ink, and one asterisk in the footer. The auth behaviour is
 * unchanged — same credentials call, same Google provider, same routes.
 */
export function SignInCard2({ googleEnabled = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError(
          "That email and password don't match. Check both and try again.",
        );
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen flex-col bg-off-black text-chalk">
      <header className="border-b border-concrete">
        <div className="mx-auto flex w-full max-w-5xl items-center px-6 py-5">
          <Link href="/welcome" className="text-sm font-bold tracking-tight">
            Viral
          </Link>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight">Sign in.</h1>
          <p className="mt-2 text-sm text-concrete">Viral is invite-only.</p>

          <form onSubmit={submit} className="mt-8 grid gap-4">
            <Field>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && (
              <p className="border-l-2 border-signal pl-3 text-sm text-chalk">
                {error}
              </p>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-6 flex items-center gap-4 text-xs text-concrete">
                <span className="h-px flex-1 bg-concrete" />
                or
                <span className="h-px flex-1 bg-concrete" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn("google", { callbackUrl: "/" })}
              >
                Continue with Google
              </Button>
            </>
          )}

          <FieldHint className="mt-6">
            No account?{" "}
            <Link
              href="/welcome/request"
              className="text-chalk underline underline-offset-2 decoration-signal"
            >
              Request access
            </Link>
          </FieldHint>
        </div>
      </div>

      <footer className="border-t border-concrete">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-6 text-xs text-concrete">
          <Asterisk className="text-concrete" size={12} />
          <span>A Shifu Labs tool</span>
        </div>
      </footer>
    </main>
  );
}
