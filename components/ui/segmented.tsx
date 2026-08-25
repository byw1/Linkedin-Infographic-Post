"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  /** Unique per instance — two groups sharing an id will animate into each other. */
  layoutId: string;
  size?: "default" | "sm";
  className?: string;
}

/**
 * Segmented control. The active pill is a shared-layout element, so
 * switching tabs slides the pill rather than cross-fading two states —
 * this is the one `layoutId` worth spending in the whole app (plus the
 * nav rail). Never run more than two layoutId groups on one screen.
 *
 * The `p-[3px]` gutter and `h-[calc(100%-1px)]` trigger are load-bearing:
 * that 3px inset is what makes the pill look recessed into the track
 * instead of stacked on top of it.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  layoutId,
  size = "default",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
        size === "sm" ? "h-8" : "h-9",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-sm font-medium outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              active ? "text-foreground" : "text-foreground/60 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ duration: duration.base, ease: ease.standard }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
