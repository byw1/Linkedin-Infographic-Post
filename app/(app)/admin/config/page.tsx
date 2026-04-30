import { getSettings } from "@/lib/settings";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { ConfigView } from "@/components/admin/config-view";
import { EmailForm } from "@/components/admin/email-form";
import { GoogleAuthForm } from "@/components/admin/google-auth-form";

export const dynamic = "force-dynamic";

// Configuration is the catch-all admin surface for app-wide knobs.
// Editable database-stored settings (SMTP, Google OAuth, email
// allowlist) sit at the top as full forms; the read-only runtime
// + env-var dump lives below for when you need to debug what's
// injected at deploy time.
export default async function AdminConfigPage() {
  const settings = await getSettings(true);

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Everything the app sees right now. Database-backed settings (SMTP,
          sign-in providers, allowlist) are editable below; environment
          variables come from Railway and are shown read-only at the bottom.
        </p>
      </header>

      <section id="email" className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold">Email (SMTP)</h3>
          <p className="text-sm text-muted-foreground">
            Used for invite emails and access-request notifications. Works
            with Resend, Postmark, SendGrid, AWS SES, Mailgun, or your own
            server.
          </p>
        </header>
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

      <section id="auth" className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold">Sign-in providers</h3>
          <p className="text-sm text-muted-foreground">
            Email + password is always available. Optionally enable Google
            OAuth.
          </p>
        </header>
        <GoogleAuthForm
          initialClientId={settings.google?.clientId ?? ""}
          enabled={Boolean(settings.google?.clientId && settings.google?.clientSecret)}
        />
      </section>

      <section id="allowlist" className="space-y-3">
        <header className="space-y-1">
          <h4 className="text-base font-semibold">Email allowlist (Google)</h4>
          <p className="text-sm text-muted-foreground">
            Optional. Only used by Google sign-in to gate which emails can
            link to existing accounts. Invite-only flow doesn&apos;t need this.
          </p>
        </header>
        <AllowlistForm initial={settings.allowedEmails} />
      </section>

      <section id="env" className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold">Runtime + environment</h3>
          <p className="text-sm text-muted-foreground">
            What the running process sees. Env vars are baked in by Railway
            at deploy time and can&apos;t be changed from here — update them
            in your Railway service config and redeploy.
          </p>
        </header>
        <ConfigView />
      </section>
    </div>
  );
}
