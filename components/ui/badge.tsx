import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// 12px icons inside badges — smaller than the 16px used everywhere else,
// which is what keeps a badge from reading as a small button.
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap border px-2 py-0.5 text-xs font-medium [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success-bg text-success",
        warning: "border-transparent bg-warning-bg text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/**
 * Status dot. The only place an arbitrary hue is allowed to appear —
 * 6px on cards, 8px (`size-2`) on column headers. Never a fill, never text.
 */
function Dot({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("size-1.5 shrink-0 bg-muted-foreground", className)}
      {...props}
    />
  );
}

// The 8-colour entity ring is gone with the palette — four inks cannot
// encode eight identities. The dot is now a plain marker; entity names
// are always rendered next to it, so nothing that was readable stopped
// being readable.

export { Badge, Dot, badgeVariants };
