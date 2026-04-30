import { getSettings } from "@/lib/settings";
import { EmailForm } from "@/components/admin/email-form";

export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  const settings = await getSettings(true);
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Email</h2>
        <p className="text-sm text-muted-foreground">
          SMTP credentials used to send invite emails. Works with Resend,
          Postmark, SendGrid, AWS SES, Mailgun, or your own server.
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
  );
}
