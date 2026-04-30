import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV: { slug: string; label: string; description: string }[] = [
  { slug: "health", label: "Health", description: "Worker + storage status" },
  { slug: "access-requests", label: "Access requests", description: "Review applicants" },
  { slug: "invites", label: "Invites", description: "Add new members" },
  { slug: "email", label: "Email", description: "SMTP for invites" },
  { slug: "auth", label: "Sign-in", description: "Google + email allowlist" },
  { slug: "themes", label: "Themes", description: "Brand themes (official)" },
  { slug: "tools", label: "Tools", description: "Curated tool catalog" },
  { slug: "config", label: "Configuration", description: "Read-only env" },
];

// Vertical-nav shell shared across /admin/*. Each section renders
// in its own route file so the page only loads what it needs and
// deep-links survive bookmarks. The active item is computed from
// the URL via a relative <Link>; route group params would require
// a client component just to read the segment, which is not worth
// the JS for a static nav.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "admin") redirect("/");

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          App-wide settings. For your own account, see{" "}
          <Link href="/settings" className="underline">Settings</Link>.
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1 text-sm md:sticky md:top-20 md:self-start">
          {NAV.map((item) => (
            <AdminNavLink
              key={item.slug}
              href={`/admin/${item.slug}`}
              label={item.label}
              description={item.description}
            />
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

// Server component rendering of the nav item. Active state isn't
// applied here (it'd require knowing the current URL); we render a
// neutral state and rely on hover + the section heading on each
// page to orient the admin. Keeping this server-rendered avoids
// shipping a 'use client' boundary for the whole shell.
function AdminNavLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 hover:bg-secondary"
    >
      <div className="font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">{description}</div>
    </Link>
  );
}
