import { PasswordForm } from "@/components/account/password-form";

export const dynamic = "force-dynamic";

export default function SettingsPasswordPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Change password</h2>
        <p className="text-sm text-muted-foreground">
          Pick something at least 8 characters. Sign-out + sign-in elsewhere
          isn&apos;t forced after a change — your existing sessions stay
          valid.
        </p>
      </header>
      <PasswordForm />
    </section>
  );
}
