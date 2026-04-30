import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageView } from "@/components/docs/page-view";

export const dynamic = "force-dynamic";

export default async function DocPagePage({
  params,
}: {
  params: { slug: string };
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const page = await prisma.docPage.findUnique({
    where: { slug: params.slug },
    include: {
      updatedBy: { select: { name: true, email: true } },
    },
  });
  if (!page) notFound();

  return (
    <PageView
      page={{
        id: page.id,
        slug: page.slug,
        title: page.title,
        markdown: page.markdown,
        position: page.position,
        updatedAt: page.updatedAt.toISOString(),
        updatedBy: page.updatedBy
          ? { name: page.updatedBy.name, email: page.updatedBy.email }
          : null,
      }}
      canEdit={isAdmin}
    />
  );
}
