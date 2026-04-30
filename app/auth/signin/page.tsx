import Link from "next/link";
import { redirect } from "next/navigation";
import { isFirstRun } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SignInForm } from "@/components/auth/sign-in-form";
import "./signin.css";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await isFirstRun()) redirect("/setup");
  const { google } = await getSettings();
  const googleEnabled = Boolean(google?.clientId && google?.clientSecret);

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="signin-aurora" />

      <Link
        href="/welcome"
        className="signin-logo flex items-center gap-2 text-base font-semibold tracking-tight"
      >
        <svg
          width={28}
          height={28}
          viewBox="0 0 24 24"
          aria-hidden
          className="shrink-0"
        >
          <rect className="signin-bar signin-bar-1" x={3} y={14} width={4} height={7} rx={1} fill="#a5b4fc" />
          <rect className="signin-bar signin-bar-2" x={10} y={9} width={4} height={12} rx={1} fill="#818cf8" />
          <rect className="signin-bar signin-bar-3" x={17} y={4} width={4} height={17} rx={1} fill="#6366f1" />
        </svg>
        viral
      </Link>

      <div className="signin-headline mt-8 max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to keep shipping. Don&apos;t have an account yet?{" "}
          <Link href="/welcome/request" className="underline hover:text-foreground">
            Request access
          </Link>
          .
        </p>
      </div>

      <div className="signin-card-enter mt-8 w-full max-w-md">
        <div className="signin-card rounded-2xl border bg-card/95 p-8 backdrop-blur">
          <SignInForm googleEnabled={googleEnabled} />
        </div>
      </div>

      <Link
        href="/welcome"
        className="signin-back mt-8 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to home
      </Link>
    </main>
  );
}
