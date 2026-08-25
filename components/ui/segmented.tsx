"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  size?: "default" | "sm";
  className?: string;
}

/**
 * Segmented control. The active option used to be a shared-layout pill
 * that slid between positions; that motion is gone. Selection now reads
 * structurally — the active segment carries a Signal underline and
 * full-strength ink, the rest sit in Concrete.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  size = "default",
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-fit items-stretch border border-concrete",
        size === "sm" ? "h-8" : "h-9",
        className,
      )}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap px-4 text-sm",
              i > 0 && "border-l border-concrete",
              active
                ? "font-bold text-chalk"
                : "text-chalk/60 hover:text-chalk",
            )}
          >
            {option.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 bg-signal"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
