import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ThemesView } from "@/components/themes-view";

export const dynamic = "force-dynamic";

export default async function ThemesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Themes</h1>
        <p className="text-sm text-muted-foreground">
          Brand tokens for your posts. Pick one in the editor; the same colors
          and fonts apply to the preview, the rendered PNG/PDF, and what Claude
          sees when you generate new HTML.
        </p>
      </header>
      <ThemesView mode="member" />
    </main>
  );
}
