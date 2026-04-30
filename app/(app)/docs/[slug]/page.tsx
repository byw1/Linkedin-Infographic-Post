import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageView } from "@/components/docs/page-view";

export const dynamic = "force-dynamic";

const UNCATEGORIZED = "Uncategorized";

export default async function DocPagePage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  // Pull the active page + the entire page list in one round trip.
  // The list drives prev/next navigation at the bottom of the
  // article — same ordering the sidebar uses (section group, then
  // position) so prev/next walks the visual outline.
  const [page, all] = await Promise.all([
    prisma.docPage.findUnique({
      where: { slug: params.slug },
      include: { updatedBy: { select: { name: true, email: true } } },
    }),
    prisma.docPage.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { slug: true, title: true, section: true },
    }),
  ]);
  if (!page) notFound();

  // Sort sections (alpha; Uncategorized last), then flatten so
  // prev/next walks across sections naturally.
  const sectionsOrder = (() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const p of all) {
      const key = p.section?.trim() || UNCATEGORIZED;
      if (!seen.has(key)) {
        seen.add(key);
        order.push(key);
      }
    }
    return order.sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  })();
  const flat = sectionsOrder.flatMap((s) =>
    all.filter((p) => (p.section?.trim() || UNCATEGORIZED) === s),
  );
  const idx = flat.findIndex((p) => p.slug === page.slug);
  const prev =
    idx > 0 ? { slug: flat[idx - 1].slug, title: flat[idx - 1].title } : null;
  const next =
    idx >= 0 && idx < flat.length - 1
      ? { slug: flat[idx + 1].slug, title: flat[idx + 1].title }
      : null;

  return (
    <PageView
      page={{
        id: page.id,
        slug: page.slug,
        title: page.title,
        section: page.section,
        markdown: page.markdown,
        position: page.position,
        updatedAt: page.updatedAt.toISOString(),
        updatedBy: page.updatedBy
          ? { name: page.updatedBy.name, email: page.updatedBy.email }
          : null,
      }}
      canEdit={isAdmin}
      prev={prev}
      next={next}
    />
  );
}
