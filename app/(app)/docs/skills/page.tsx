import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SkillsSection } from "@/components/skills-section";

export const dynamic = "force-dynamic";

// /docs/skills is a fixed sidebar entry that takes precedence over
// the [slug] route (Next.js prefers static segments). Renders the
// existing SkillsSection so members can browse + download skills.
// Reserved as a slug in the API layer so a regular page can't
// shadow it.
export default async function DocsSkillsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold">Skills</h2>
        <p className="text-sm text-muted-foreground">
          Markdown skill files for Claude.{" "}
          {isAdmin
            ? "Upload one to share with the team."
            : "Download to use with Claude Projects or Claude Code."}
        </p>
      </header>
      <SkillsSection canManage={isAdmin} />
    </div>
  );
}
