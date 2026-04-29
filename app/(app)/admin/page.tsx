import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { InvitesForm } from "@/components/admin/invites-form";
import { GoogleAuthForm } from "@/components/admin/google-auth-form";
import { EmailForm } from "@/components/admin/email-form";
import { HealthStatus } from "@/components/admin/health-status";
import { ConfigView } from "@/components/admin/config-view";
import { StorageTest } from "@/components/admin/storage-test";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/");

  const settings = await getSettings(true);

  return (
    <div className="container mx-auto max-w-3xl space-y-12 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          App-wide settings. For your own account, see{" "}
          <a href="/settings" className="underline">
            Settings
          </a>
          . Themes have a dedicated admin view at{" "}
          <a href="/admin/themes" className="underline">
            /admin/themes
          </a>
          .
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Health</h2>
        <HealthStatus />
        <StorageTest />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Generate a link, share it, or — once Email is configured below — send
          and re-send the invite by email. Recipient sets their own password.
          Default 14-day expiry.
        </p>
        <InvitesForm emailReady={settings.email !== null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Email</h2>
        <p className="text-sm text-muted-foreground">
          SMTP credentials used to send invite emails. Works with Resend,
          Postmark, SendGrid, AWS SES, Mailgun, or your own server.
        </p>
        <EmailForm
          initial={{
            host: settings.email?.host ?? "",
            port: settings.email?.port ?? 587,
            user: settings.email?.user ?? "",
            from: settings.email?.from ?? "",
          }}
          enabled={settings.email !== null}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sign-in providers</h2>
        <p className="text-sm text-muted-foreground">
          Email and password is always available. Optionally enable Google.
        </p>
        <GoogleAuthForm
          initialClientId={settings.google?.clientId ?? ""}
          enabled={Boolean(settings.google?.clientId && settings.google?.clientSecret)}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Email allowlist (Google sign-in)</h2>
        <p className="text-sm text-muted-foreground">
          Optional. Only used by Google sign-in to gate which emails can link to
          existing accounts. Invite-only flow doesn&apos;t need this.
        </p>
        <AllowlistForm initial={settings.allowedEmails} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Everything the app sees right now. Env vars are set on Railway and
          shown read-only with secrets masked. Database settings are editable in
          the sections above.
        </p>
        <ConfigView />
      </section>
    </div>
  );
}
