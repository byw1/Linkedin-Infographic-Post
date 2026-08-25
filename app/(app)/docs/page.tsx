import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// /docs sends the user to the first page in the sidebar. If there
// are no pages yet (a fresh install where the migration hasn't run
// or someone deleted everything), an admin sees a prompt to create
// one and a member sees a friendly "ask an admin" message.
export default async function DocsIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  const first = await prisma.docPage.findFirst({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { slug: true },
  });
  if (first) redirect(`/docs/${first.slug}`);

  return (
    <div className="border bg-card p-8 text-center text-card-foreground">
      <h2 className="text-lg font-semibold">No pages yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isAdmin
          ? "Hit + New page in the sidebar to create the first one."
          : "An admin hasn't added any pages here yet."}
      </p>
    </div>
  );
}
