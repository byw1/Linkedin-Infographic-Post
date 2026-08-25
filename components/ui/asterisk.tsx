import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Shifu Labs mark: a six-spoke geometric flat-cut asterisk.
 *
 * Rules that travel with it:
 * - ONE per surface, ever. Never doubled, never decorative, never a
 *   repeating background. If a page has one in its footer, it cannot
 *   have another anywhere else on that page.
 * - Minimum 12px, with clear space of half the mark's width on all
 *   sides. It has to hold up in a single ink, black on white, at 16px —
 *   which is why the spokes are flat-cut rectangles and not strokes.
 * - Ink rule: on a child surface it prints in that surface's own
 *   foreground ink, never Signal. Orange is the parent's voice and
 *   belongs on parent surfaces only. That is why this takes its colour
 *   from `currentColor` and offers no colour prop.
 */
export function Asterisk({
  size = 16,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {/* Six flat-cut spokes at 60° intervals around the centre. */}
      {[0, 60, 120].map((deg) => (
        <rect
          key={deg}
          x="10.6"
          y="1"
          width="2.8"
          height="22"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}
