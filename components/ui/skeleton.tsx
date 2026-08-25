import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Match the real element's height exactly (`h-9` for a control, `h-5` for
 * a text-sm line) or the swap jumps when data lands.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
}

/**
 * Optional shimmer sweep for larger placeholder blocks. Slower than the
 * 200ms hover token so it reads as ambient work rather than a hover
 * response; 4% white is the ceiling — brighter looks like a different product.
 */
function SkeletonShimmer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-accent", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent motion-reduce:hidden" />
    </div>
  );
}

export { Skeleton, SkeletonShimmer };
