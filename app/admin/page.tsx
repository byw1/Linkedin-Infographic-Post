import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { StorageForm } from "@/components/admin/storage-form";
import { InvitesForm } from "@/components/admin/invites-form";
import { GoogleAuthForm } from "@/components/admin/google-auth-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/");

  const settings = await getSettings(true);

  return (
    <main className="container mx-auto max-w-3xl space-y-12 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, auth, and storage. Changes take effect within ~30 seconds.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Generate a link, share it in iMessage / Slack / wherever. The recipient
          sets their own password. Links expire in 14 days by default.
        </p>
        <InvitesForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sign-in providers</h2>
        <p className="text-sm text-muted-foreground">
          Email and password is always available. Optionally enable Google
          sign-in for invited users — they&apos;ll need to use the email Google
          returns.
        </p>
        <GoogleAuthForm
          initialClientId={settings.google?.clientId ?? ""}
          enabled={Boolean(settings.google?.clientId && settings.google?.clientSecret)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Email allowlist (Google sign-in)</h2>
        <p className="text-sm text-muted-foreground">
          Optional fallback only used if you keep an env-based allowlist. With
          invites you don&apos;t need this — invited users are the allowlist.
        </p>
        <AllowlistForm initial={settings.allowedEmails} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Storage (S3-compatible)</h2>
        <p className="text-sm text-muted-foreground">
          PNG export and logo uploads need this. Cloudflare R2 recommended.
        </p>
        <StorageForm initial={settings.storage} />
      </section>
    </main>
  );
}
