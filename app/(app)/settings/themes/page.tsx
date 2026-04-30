import { auth } from "@/lib/auth";
import { ThemesView } from "@/components/themes-view";

export const dynamic = "force-dynamic";

export default async function SettingsThemesPage() {
  const session = await auth();
  const isAdmin = session!.user.role === "admin";

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Themes</h2>
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
      </header>
      <ThemesView mode="member" />
    </section>
  );
}
