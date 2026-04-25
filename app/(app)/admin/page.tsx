import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isStorageConfigured } from "@/lib/storage";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { InvitesForm } from "@/components/admin/invites-form";
import { GoogleAuthForm } from "@/components/admin/google-auth-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/");

  const settings = await getSettings(true);
  const storageReady = await isStorageConfigured();

  return (
    <div className="container mx-auto max-w-3xl space-y-12 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and auth. Changes take effect within ~30 seconds.
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
          sign-in for invited users.
        </p>
        <GoogleAuthForm
          initialClientId={settings.google?.clientId ?? ""}
          enabled={Boolean(settings.google?.clientId && settings.google?.clientSecret)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Email allowlist (Google sign-in)</h2>
        <p className="text-sm text-muted-foreground">
          Optional. Only used by Google sign-in to gate which Google emails can
          link to existing accounts. Invite-only flow doesn&apos;t need this.
        </p>
        <AllowlistForm initial={settings.allowedEmails} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Storage</h2>
        <div className="rounded-md border p-4 text-sm">
          {storageReady ? (
            <span className="text-muted-foreground">
              Configured via environment variables.{" "}
              <span className="font-medium text-foreground">PNG export is enabled.</span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Not configured. Set <code>S3_ENDPOINT</code>, <code>S3_ACCESS_KEY</code>,{" "}
              <code>S3_SECRET_KEY</code>, <code>S3_BUCKET</code>, and{" "}
              <code>S3_PUBLIC_URL</code> on both the web and worker services in
              Railway. PNG export is unavailable until then.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
