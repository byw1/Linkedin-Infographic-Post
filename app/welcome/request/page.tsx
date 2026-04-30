import Link from "next/link";
import { RequestAccessForm } from "@/components/welcome/request-access-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Request access · viral",
};

export default function RequestAccessPage() {
  return (
    <main className="container mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <Link
          href="/welcome"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Request access</h1>
        <p className="text-sm text-muted-foreground">
          We keep this group small on purpose. If a friend pointed you here,
          tell us a little about yourself and who sent you. We&apos;ll get
          back to you within a few days.
        </p>
      </header>
      <RequestAccessForm />
      <p className="mt-8 text-xs text-muted-foreground">
        Already in?{" "}
        <Link href="/auth/signin" className="underline">
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}
