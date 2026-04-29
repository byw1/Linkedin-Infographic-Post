import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEFAULT_DOCS } from "@/lib/docs-default";
import { DocsView } from "@/components/docs-view";

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
    <main className="container mx-auto max-w-3xl space-y-6 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
        <p className="text-sm text-muted-foreground">
          Team handbook. Anyone signed in can read.{" "}
          {isAdmin ? "You can edit." : "Only admins can edit."}
        </p>
      </header>
      <DocsView initial={initial} initialCustomized={customized} canEdit={isAdmin} />
    </main>
  );
}
