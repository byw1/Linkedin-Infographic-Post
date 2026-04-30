import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { memberStats } from "@/lib/member-stats";
import { readSocials } from "@/lib/profile";
import { refreshUrl } from "@/lib/storage";
import { MemberProfileView } from "@/components/member-profile-view";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  const m = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      tags: true,
      bio: true,
      socials: true,
      createdAt: true,
      lastSeenAt: true,
      bannedAt: true,
      shareTracked: true,
    },
  });
  if (!m) notFound();
  if (m.bannedAt && !isAdmin && m.id !== session.user.id) notFound();
  const stats = await memberStats(m.id);
  const image = m.image ? ((await refreshUrl(m.image)) ?? m.image) : null;

  return (
    <main className="container mx-auto max-w-5xl space-y-6 py-10">
      <div>
        <Link
          href="/members"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All members
        </Link>
      </div>
      <MemberProfileView
        viewerIsAdmin={isAdmin}
        member={{
          id: m.id,
          name: m.name,
          email: m.email,
          image,
          role: m.role,
          tags: m.tags,
          bio: m.bio,
          socials: readSocials(m.socials),
          createdAt: m.createdAt.toISOString(),
          lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
          banned: m.bannedAt !== null,
          isSelf: m.id === session.user.id,
          shareTracked: m.shareTracked,
          stats: {
            postsShared: stats.postsShared,
            totalImpressions: stats.totalImpressions,
            avgEngagementRate: stats.avgEngagementRate,
            lastTrackedAt: stats.lastTrackedAt?.toISOString() ?? null,
          },
        }}
      />
    </main>
  );
}
