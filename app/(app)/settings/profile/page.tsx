import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSocials } from "@/lib/profile";
import { refreshUrl } from "@/lib/storage";
import { ProfileEditor } from "@/components/account/profile-editor";

export const dynamic = "force-dynamic";

// Auth is enforced by the parent /settings/layout.tsx. Pull the
// user's current profile up front so the editor lands populated
// without a client round-trip.
export default async function SettingsProfilePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      bio: true,
      tags: true,
      socials: true,
    },
  });
  const image = me?.image ? ((await refreshUrl(me.image)) ?? me.image) : null;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Avatar, name, bio, tags, and social links. Visible to other members
          on the directory and your profile page.
        </p>
      </header>
      <ProfileEditor
        endpoint="/api/account/profile"
        initial={{
          name: me?.name ?? null,
          email: me?.email ?? session!.user.email ?? "",
          image,
          bio: me?.bio ?? null,
          tags: me?.tags ?? [],
          socials: readSocials(me?.socials ?? null),
        }}
      />
    </section>
  );
}
