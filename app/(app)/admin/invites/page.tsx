import { getSettings } from "@/lib/settings";
import { InvitesView } from "@/components/admin/invites-view";

export const dynamic = "force-dynamic";

export default async function AdminInvitesPage() {
  const settings = await getSettings(true);
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Invites</h2>
        <p className="text-sm text-muted-foreground">
          Generate a link, share it, or — once Email is configured — send by
          email. The recipient sets their own password. Default 14-day expiry.
          Used invites collapse out of the way once redeemed.
        </p>
      </header>
      <InvitesView emailReady={settings.email !== null} />
    </section>
  );
}
