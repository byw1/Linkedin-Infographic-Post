import { auth } from "@/lib/auth";
import { ToolsBrowser } from "@/components/docs/tools-browser";

export const dynamic = "force-dynamic";

export default async function DocsToolsPage() {
  // Auth + admin bit come from the surrounding /docs layout's auth
  // gate; we re-pull here to flow `isAdmin` into the client component
  // without an extra round-trip.
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Tools</h2>
        <p className="text-sm text-muted-foreground">
          The kit the team relies on for LinkedIn — automation, scheduling,
          analytics, content. Search by name, description, or tag.{" "}
          {isAdmin
            ? "Hit Add tool to seed a new one; Edit / Delete on each card."
            : "New tool worth adding? Ping an admin."}
        </p>
      </header>
      <ToolsBrowser isAdmin={isAdmin} />
    </article>
  );
}
