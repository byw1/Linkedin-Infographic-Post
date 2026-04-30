"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  target: number;
  // Animation length in ms. Tuned to feel weighty without dragging
  // — 2.4s on a 7-figure target reads as deliberate, not slow.
  duration?: number;
  // Trigger the count once the element crosses this fraction of
  // its height into the viewport. 0.3 = fires when ~a third of
  // the number is visible.
  threshold?: number;
  className?: string;
  suffix?: string;
}

// Count-up that animates from 0 → target with an ease-out curve
// when it scrolls into view. Honors prefers-reduced-motion by
// jumping straight to the final value. Locale-formatted so big
// numbers get comma separators automatically.
export function CountUp({
  target,
  duration = 2400,
  threshold = 0.3,
  className,
  suffix = "",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    const el = ref.current;
    if (!el) return;

    // Reduced-motion users skip the animation entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      setStarted(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStarted(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started, target, threshold]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      // ease-out cubic — slows as it approaches the target so the
      // last digits feel like they're settling into place.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
