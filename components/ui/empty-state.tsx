import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Deliberately plain: a bordered card with one muted sentence. No
 * illustration, no big icon, no CTA button inside the box. Copy should be
 * a full sentence with a period that says what will make it fill up.
 *
 * `size` scales the padding by how much of the page this is standing in
 * for — `sm` for a minor slot, `lg` for a whole page's primary content.
 */
export function EmptyState({
  children,
  size = "default",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent
        className={cn(
          "text-center text-sm text-muted-foreground",
          size === "sm" && "py-6",
          size === "default" && "py-8",
          size === "lg" && "py-12",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/** Bare variant for inside a popover or menu, where a card would double up. */
export function EmptyLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("px-2 py-6 text-center text-sm text-muted-foreground", className)}>
      {children}
    </p>
  );
}
