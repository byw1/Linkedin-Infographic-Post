import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export const dynamic = "force-dynamic";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Fetched server-side so the sidebar lands populated on first
  // paint — title + slug only, the page body comes via client fetch
  // when the user clicks. Keeps the per-page payload small as the
  // handbook grows.
  const pages = await prisma.docPage.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      section: true,
      position: true,
    },
  });

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Docs</h1>
        <p className="text-sm text-muted-foreground">
          Team handbook. Each topic is its own page —{" "}
          {session.user.role === "admin"
            ? "click + New page to add one, or Edit to change an existing one."
            : "ask an admin to add or change a page."}
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <DocsSidebar pages={pages} canEdit={session.user.role === "admin"} />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
