import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Match the real element's height exactly (`h-9` for a control, `h-5` for
 * a text-sm line) or the swap jumps when data lands.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse bg-accent", className)} {...props} />
  );
}

/**
 * Optional shimmer sweep for larger placeholder blocks. Slower than the
 * 200ms hover token so it reads as ambient work rather than a hover
 * response; 4% white is the ceiling — brighter looks like a different product.
 */
function SkeletonShimmer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden bg-accent", className)}
      {...props}
    >
      <div className="absolute inset-0 animate-shimmer motion-reduce:hidden" />
    </div>
  );
}

export { Skeleton, SkeletonShimmer };
