import { ThemesView } from "@/components/themes-view";

export const dynamic = "force-dynamic";

// Auth is enforced by the parent /admin/layout.tsx. This page only
// renders content; the sidebar wrapper comes from the layout.
export default function AdminThemesPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Themes</h2>
        <p className="text-sm text-muted-foreground">
          Every theme on the system, with owner. Toggle the official badge to
          publish a member&apos;s theme to everyone, or upload your own as
          official from the start.
        </p>
      </header>
      <ThemesView mode="admin" />
    </section>
  );
}
