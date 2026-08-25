import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Page wrapper. This used to run a 500ms fade-and-rise on every
 * navigation. Motion in this brand is near zero — functional state
 * changes only, nothing decorative — so pages now simply appear.
 * Kept as a component so the layout doesn't need restructuring, and so
 * there is one obvious place to look if page-level behaviour returns.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/**
 * The page header pair: title over a Concrete description, separated
 * from the content below by a hairline rather than by spacing alone.
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
      className={cn(
        "mb-8 flex items-start justify-between gap-4 border-b border-concrete pb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-concrete">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </header>
  );
}
