import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ThemesView } from "@/components/themes-view";

export const dynamic = "force-dynamic";

export default async function AdminThemesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/themes");

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Themes (admin)</h1>
        <p className="text-sm text-muted-foreground">
          Every theme on the system, with owner. Toggle the official badge to
          publish a member&apos;s theme to everyone, or upload your own as
          official from the start.
        </p>
      </header>
      <ThemesView mode="admin" />
    </main>
  );
}
