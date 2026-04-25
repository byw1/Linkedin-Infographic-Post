import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AllowlistForm } from "@/components/admin/allowlist-form";
import { StorageForm } from "@/components/admin/storage-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/");

  const settings = await getSettings(true);

  return (
    <main className="container mx-auto max-w-3xl space-y-10 py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Configure access and storage. Changes take effect within ~30 seconds.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Email allowlist</h2>
        <p className="text-sm text-muted-foreground">
          One email per line. The bootstrap admin
          {process.env.BOOTSTRAP_ADMIN_EMAIL ? ` (${process.env.BOOTSTRAP_ADMIN_EMAIL}) ` : " "}
          is always allowed.
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
