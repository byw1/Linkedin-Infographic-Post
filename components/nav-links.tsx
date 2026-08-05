"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "New" },
  { href: "/posts", label: "Posts" },
  { href: "/members", label: "Members" },
  { href: "/docs", label: "Docs" },
] as const;

/**
 * Top-nav items. Three simultaneous 200ms deltas on hover — a 2px nudge,
 * an accent fill, and a rail that fades in under the label. The rail sits
 * at 100% for the active route and 40% on hover, so the current page
 * always outranks whatever the mouse is over.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:translate-y-[-1px] hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <span
              className={cn(
                "absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary transition-all duration-200",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
