import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SectionNav } from "@/components/section-nav";

export const dynamic = "force-dynamic";

const NAV: { slug: string; label: string; description: string }[] = [
  { slug: "health", label: "Health", description: "Worker + storage status" },
  { slug: "access-requests", label: "Access requests", description: "Review applicants" },
  { slug: "invites", label: "Invites", description: "Add new members" },
  { slug: "themes", label: "Themes", description: "Brand themes (official)" },
  { slug: "config", label: "Configuration", description: "SMTP, sign-in, env" },
];

// Vertical-nav shell shared across /admin/*. Each section renders
// in its own route file so the page only loads what it needs and
// deep-links survive bookmarks. The nav itself is the one client
// island here — it reads the pathname to mark the active section.
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
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          App-wide settings. For your own account, see{" "}
          <Link href="/settings" className="underline">Settings</Link>.
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <SectionNav
          items={NAV.map((item) => ({
            href: `/admin/${item.slug}`,
            label: item.label,
            description: item.description,
          }))}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
