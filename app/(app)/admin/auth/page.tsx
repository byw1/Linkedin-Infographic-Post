import { getSettings } from "@/lib/settings";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { GoogleAuthForm } from "@/components/admin/google-auth-form";

export const dynamic = "force-dynamic";

export default async function AdminAuthPage() {
  const settings = await getSettings(true);
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Sign-in</h2>
          <p className="text-sm text-muted-foreground">
            Email and password is always available. Optionally enable Google.
          </p>
        </header>
        <GoogleAuthForm
          initialClientId={settings.google?.clientId ?? ""}
          enabled={Boolean(settings.google?.clientId && settings.google?.clientSecret)}
        />
      </section>
      <section className="space-y-3">
        <header className="space-y-1">
          <h3 className="text-lg font-semibold">Email allowlist (Google sign-in)</h3>
          <p className="text-sm text-muted-foreground">
            Optional. Only used by Google sign-in to gate which emails can link
            to existing accounts. Invite-only flow doesn&apos;t need this.
          </p>
        </header>
        <AllowlistForm initial={settings.allowedEmails} />
      </section>
    </div>
  );
}
