import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";
import { SharingForm } from "@/components/account/sharing-form";
import { ThemesView } from "@/components/themes-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  // Fetch the sharing flag server-side so the toggle lands in the
  // right state on first paint without a client round-trip.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shareTracked: true },
  });

  return (
    <main className="container mx-auto max-w-3xl space-y-10 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account. For app-wide settings (invites, sign-in providers,
          health), {isAdmin ? "see the Admin tab." : "ask an admin."}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Profile</h2>
        <ProfileForm
          initialName={session.user.name ?? ""}
          email={session.user.email ?? ""}
          role={session.user.role}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Change password</h2>
        <PasswordForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sharing</h2>
        <SharingForm initialShareTracked={me?.shareTracked ?? true} />
      </section>

      <section id="themes" className="space-y-3">
        <h2 className="text-xl font-semibold">Themes</h2>
        <p className="text-sm text-muted-foreground">
          Brand tokens for your posts — colors and fonts that flow into the
          editor preview, the rendered PDF/PNG, and the skill download Claude
          reads.{" "}
          {isAdmin ? (
            <>
              For the global view + publishing controls, see{" "}
              <a href="/admin/themes" className="underline">
                /admin/themes
              </a>
              .
            </>
          ) : null}
        </p>
        <ThemesView mode="member" />
      </section>
    </main>
  );
}
