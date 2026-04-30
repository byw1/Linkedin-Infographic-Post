import { ToolsBrowser } from "@/components/docs/tools-browser";

export const dynamic = "force-dynamic";

export default function DocsToolsPage() {
  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
        <p className="text-sm text-muted-foreground">
          The kit the team relies on for LinkedIn — automation, scheduling,
          analytics, content. Search by name, description, or tag. New tool
          worth adding? Ping an admin.
        </p>
      </header>
      <ToolsBrowser />
    </article>
  );
}
