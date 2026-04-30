import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn cn() — clsx for conditional class composition,
// tailwind-merge to dedupe conflicting Tailwind utilities. Anywhere
// a component does `cn("h-9 ...", className)` we want later utility
// classes to win without manual ordering.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
