import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SharingForm } from "@/components/account/sharing-form";

export const dynamic = "force-dynamic";

export default async function SettingsSharingPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { shareTracked: true },
  });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Sharing</h2>
        <p className="text-sm text-muted-foreground">
          Whether your tracked posts surface to the rest of the community.
          Untracked drafts are never shared, regardless of this setting.
        </p>
      </header>
      <SharingForm initialShareTracked={me?.shareTracked ?? true} />
    </section>
  );
}
