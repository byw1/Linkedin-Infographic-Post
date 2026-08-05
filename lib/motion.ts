import type { Variants } from "framer-motion";

// Motion tokens. `base` (200ms) is the workhorse — hover lift, press,
// nav, chevrons, tabs all run on it. 500ms is the ceiling in this
// system and only the page entrance reaches it.
export const duration = {
  instant: 0.1, // opacity-only reveals (icon appearing on card hover)
  fast: 0.15, //   color-only transitions
  base: 0.2, //    THE token
  slow: 0.3, //    expand/collapse, logo rotate
  page: 0.5, //    page/route entrance
} as const;

export const ease = {
  // Tailwind's default timing function — what every bare `transition-*`
  // in the app resolves to. Keep JS motion on the same curve as CSS
  // motion or the two read as different products.
  standard: [0.4, 0.0, 0.2, 1] as const,
  out: [0.0, 0.0, 0.2, 1] as const, //  entrances, decelerate
  in: [0.4, 0.0, 1.0, 1] as const, //   exits, accelerate
  inOut: [0.4, 0.0, 0.2, 1] as const,
} as const;

// Springs are for layout and drag only. Putting a spring on hover
// breaks the flat 200ms feel that holds the whole system together.
export const spring = {
  layout: { type: "spring", stiffness: 400, damping: 40, mass: 1 },
  drag: { type: "spring", stiffness: 600, damping: 35, mass: 0.6 },
} as const;

/** Wrap a grid/list. Children rise 8px, 40ms apart, after a 60ms beat. */
export const listContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.out },
  },
};

/** Section-level reveal on scroll. 12px rise, fires once, at 25% visible. */
export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: ease.out } },
};

// Cap total stagger at ~400ms. Past ~10 children the per-child delay has
// to shrink or the list reads as broken rather than composed.
export function staggerFor(count: number) {
  if (count > 20) return { staggerChildren: 0, delayChildren: 0 };
  if (count > 10) return { staggerChildren: 0.02, delayChildren: 0.06 };
  return { staggerChildren: 0.04, delayChildren: 0.06 };
}

/**
 * The signature interaction, as a class string. Anything clickable that
 * is a *surface* lifts 2px and steps its shadow up exactly one rung over
 * 200ms. Controls don't lift — they press (see the Button primitive).
 */
export const CARD_LIFT =
  "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
