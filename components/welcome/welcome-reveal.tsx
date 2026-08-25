"use client";

import { useEffect } from "react";

// Tiny IntersectionObserver mount that flips [data-reveal] elements
// to "visible" when they cross into view. Decoupled from any state —
// the actual transition lives in welcome.css. One observer for the
// whole page so we don't churn through one IO per element.
export function WelcomeReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (targets.length === 0) return;

    // If the user prefers reduced motion the CSS already short-circuits
    // the transition, so just mark everything visible immediately and
    // skip the observer entirely.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      targets.forEach((el) => el.setAttribute("data-reveal", "visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
