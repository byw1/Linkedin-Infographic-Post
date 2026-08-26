import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The Shifu Labs mark: a six-spoke geometric flat-cut asterisk.
 *
 * Rules that travel with it:
 * - One per surface. Never doubled, never decorative, never a repeating
 *   background element.
 * - Minimum 12px, with clear space of half the mark's width on all
 *   sides. It has to hold up in a single ink, black on white, at 16px —
 *   which is why the spokes are flat-cut rectangles rather than strokes.
 * - It takes its colour from `currentColor` and offers no colour prop,
 *   so on a child surface it prints in that surface's own foreground ink
 *   rather than in Signal. Orange is the parent's voice.
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
