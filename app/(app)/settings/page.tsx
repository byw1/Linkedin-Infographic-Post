import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfileForm } from "@/components/account/profile-form";
import { PasswordForm } from "@/components/account/password-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <main className="container mx-auto max-w-2xl space-y-10 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account. For app-wide settings (invites, sign-in providers,
          health), {session.user.role === "admin" ? "see the Admin tab." : "ask an admin."}
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
    </main>
  );
}
