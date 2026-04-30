import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readSocials } from "@/lib/profile";
import { refreshUrl } from "@/lib/storage";
import { ProfileEditor } from "@/components/account/profile-editor";
import { PasswordForm } from "@/components/account/password-form";
import { SharingForm } from "@/components/account/sharing-form";
import { ThemesView } from "@/components/themes-view";
import { LibraryView } from "@/components/library-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  // Pull the current profile up front so the editor lands populated
  // without a client round-trip. Avatar is re-signed through the
  // proxy so the upload widget shows the correct picture instead of
  // a stale signed URL on first paint.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      image: true,
      bio: true,
      tags: true,
      socials: true,
      shareTracked: true,
    },
  });
  const image = me?.image ? ((await refreshUrl(me.image)) ?? me.image) : null;

  return (
    <main className="container mx-auto max-w-3xl space-y-10 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account. For app-wide settings (invites, sign-in providers,
          health), {isAdmin ? "see the Admin tab." : "ask an admin."}
        </p>
        <nav className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
          <a href="#profile" className="hover:text-foreground">Profile</a>
          <a href="#password" className="hover:text-foreground">Password</a>
          <a href="#sharing" className="hover:text-foreground">Sharing</a>
          <a href="#themes" className="hover:text-foreground">Themes</a>
          <a href="#library" className="hover:text-foreground">Library</a>
        </nav>
      </header>

      <section id="profile" className="space-y-3">
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Avatar, name, bio, tags, and social links. Visible to other members
          on the directory and your profile page.
        </p>
        <ProfileEditor
          endpoint="/api/account/profile"
          initial={{
            name: me?.name ?? null,
            email: me?.email ?? session.user.email ?? "",
            image,
            bio: me?.bio ?? null,
            tags: me?.tags ?? [],
            socials: readSocials(me?.socials ?? null),
          }}
        />
      </section>

      <section id="password" className="space-y-3">
        <h2 className="text-xl font-semibold">Change password</h2>
        <PasswordForm />
      </section>

      <section id="sharing" className="space-y-3">
        <h2 className="text-xl font-semibold">Sharing</h2>
        <SharingForm initialShareTracked={me?.shareTracked ?? true} />
      </section>

      <section id="themes" className="space-y-3">
        <h2 className="text-xl font-semibold">Themes</h2>
        <p className="text-sm text-muted-foreground">
          Brand tokens for your posts — colors and fonts that flow into the
          editor preview, the rendered PDF/PNG, and the skill download Claude
          reads.{" "}
          {isAdmin ? (
            <>
              For the global view + publishing controls, see{" "}
              <a href="/admin/themes" className="underline">
                /admin/themes
              </a>
              .
            </>
          ) : null}
        </p>
        <ThemesView mode="member" />
      </section>

      <section id="library" className="space-y-3">
        <h2 className="text-xl font-semibold">Library</h2>
        <p className="text-sm text-muted-foreground">
          Logos uploaded by everyone in the community. They auto-resolve next
          time you parse HTML with the same <code>data-entity</code> slug.
          Hide ones you don&apos;t want to see — your logos stay in the pool.
        </p>
        <LibraryView />
      </section>
    </main>
  );
}
