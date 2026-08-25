import * as React from "react";
import { Asterisk } from "@/components/ui/asterisk";
import { cn } from "@/lib/utils";

/**
 * The footer endorsement line, required on every public page.
 *
 * "A Shifu Labs tool" rather than "property" — a tool isn't a place.
 * The brand doc leaves the rung-3 line unresolved, so this is the
 * working default and a one-string change if it settles differently.
 *
 * Carries the page's single asterisk, in the page's own foreground ink.
 */
export function Endorsement({ className }: { className?: string }) {
  return (
    <footer className={cn("border-t border-concrete", className)}>
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-6 text-xs text-concrete">
        <Asterisk className="text-concrete" size={12} />
        <span>A Shifu Labs tool</span>
      </div>
    </footer>
  );
}
