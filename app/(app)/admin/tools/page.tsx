import { ToolsManager } from "@/components/admin/tools-manager";

export const dynamic = "force-dynamic";

export default function AdminToolsPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
        <p className="text-sm text-muted-foreground">
          Curated catalog of LinkedIn-adjacent tools the team relies on —
          automation, scheduling, analytics, etc. Members browse the list at{" "}
          <a href="/docs/tools" className="underline">/docs/tools</a>.
          Tags are free-form (lowercase, hyphenated) so they group cleanly on
          the member page.
        </p>
      </header>
      <ToolsManager />
    </section>
  );
}
