import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEFAULT_DOCS } from "@/lib/docs-default";
import { DocsView } from "@/components/docs-view";
import { SkillsSection } from "@/components/skills-section";

export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const { docs } = await getSettings(true);
  const initial = docs ?? {
    markdown: DEFAULT_DOCS,
    updatedAt: null,
    updatedById: null,
    updatedByName: null,
  };
  const customized = docs !== null;

  return (
    <main className="container mx-auto max-w-3xl space-y-8 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
        <p className="text-sm text-muted-foreground">
          Team handbook + Claude skills. Anyone signed in can read.{" "}
          {isAdmin
            ? "You can edit the handbook and upload skills."
            : "Only admins can edit."}
        </p>
      </header>

      <SkillsSection canManage={isAdmin} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Handbook</h2>
        <DocsView initial={initial} initialCustomized={customized} canEdit={isAdmin} />
      </section>
    </main>
  );
}
