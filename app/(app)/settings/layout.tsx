import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV: { slug: string; label: string; description: string }[] = [
  { slug: "profile", label: "Profile", description: "Avatar, bio, links" },
  { slug: "password", label: "Password", description: "Change your password" },
  { slug: "sharing", label: "Sharing", description: "Community visibility" },
  { slug: "themes", label: "Themes", description: "Brand colors + fonts" },
  { slug: "library", label: "Library", description: "Community logos" },
];

// Vertical-nav shell shared across /settings/*. Same pattern as
// /admin/layout.tsx — each section renders in its own route file
// so it only fetches what it needs and deep-links survive.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const isAdmin = session.user.role === "admin";

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account. App-wide settings (invites, sign-in, health){" "}
          {isAdmin ? (
            <Link href="/admin" className="underline">live in /admin</Link>
          ) : (
            <>are admin-only — ping an admin if you need something there.</>
          )}
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1 text-sm md:sticky md:top-20 md:self-start">
          {NAV.map((item) => (
            <Link
              key={item.slug}
              href={`/settings/${item.slug}`}
              className="block rounded-md px-3 py-2 hover:bg-secondary"
            >
              <div className="font-medium">{item.label}</div>
              <div className="text-[11px] text-muted-foreground">
                {item.description}
              </div>
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
