"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

/**
 * Page entrance: 500ms fade + 8px rise, keyed on the pathname so it
 * replays on every navigation. Deliberately no exit — pages leave
 * instantly. Wrapping this in `AnimatePresence mode="wait"` would double
 * the perceived latency of every click in the app.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.page, ease: ease.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * The page header pair: 24px semibold title with the only `tracking-tight`
 * in the app chrome, over a 14px muted description.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-6 flex items-start justify-between gap-4", className)}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
