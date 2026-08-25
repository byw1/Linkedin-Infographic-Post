"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  href: string;
  label: string;
  description?: string;
}

/**
 * Sidebar nav for the /admin and /settings shells. Three simultaneous
 * 200ms deltas on hover — a 2px nudge on X, an accent fill, and a rail
 * that fades in at the left edge. The rail sits at 100% for the active
 * route and 40% on hover, so the current section always outranks
 * whatever the mouse happens to be over.
 *
 * This is a client component purely so it can read the pathname; the
 * surrounding layouts stay server-rendered.
 */
export function SectionNav({ items }: { items: readonly SectionNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1 text-sm md:sticky md:top-20 md:self-start">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative block rounded-md px-3 py-2 transition-all duration-200",
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : "hover:translate-x-0.5 hover:bg-accent/60 hover:text-accent-foreground",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
              )}
            />
            <span className="block font-medium">{item.label}</span>
            {item.description && (
              <span className="block text-[11px] text-muted-foreground">
                {item.description}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
