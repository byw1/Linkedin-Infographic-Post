import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refreshUrl } from "@/lib/storage";
import { NavMenu } from "@/components/nav-menu";
import { NavLinks } from "@/components/nav-links";

export async function TopNav() {
  const session = await auth();
  const user = session?.user;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/auth/signin" });
  }

  // Pull the latest avatar / name straight from the DB so a
  // freshly-uploaded avatar shows up in the nav without waiting
  // for a JWT refresh. Light query — single user lookup, scoped
  // to the columns we actually display.
  let avatarUrl: string | null = null;
  let displayName: string | null = null;
  if (user?.id) {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, image: true },
    });
    displayName = me?.name ?? null;
    avatarUrl = me?.image ? ((await refreshUrl(me.image)) ?? me.image) : null;
  }

  return (
    // Opaque, and separated by a hairline rather than by elevation.
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-semibold"
          >
            <span className="flex size-7 shrink-0 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt=""
                aria-hidden="true"
                className="size-5"
              />
            </span>
            Viral
          </Link>
          {user && <NavLinks />}
        </div>
        {user && (
          <NavMenu
            email={user.email}
            name={displayName}
            image={avatarUrl}
            isAdmin={user.role === "admin"}
            signOutAction={signOutAction}
          />
        )}
      </div>
    </header>
  );
}
