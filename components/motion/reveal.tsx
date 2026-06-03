"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { shouldAnimate } from "@/lib/motion";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger position; multiplies the per-item delay. */
  index?: number;
}

/**
 * Fades its children up when first scrolled into view. Renders hidden via the
 * `.reveal` class and adds `.reveal--in` on intersection. Falls back to showing
 * content immediately when reduced-motion is on or IntersectionObserver is
 * missing. JS is required for the reveal — acceptable in this fully-client app.
 */
export function Reveal({ index = 0, className, children, style, ...rest }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const active = shouldAnimate({
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      hasIntersectionObserver: "IntersectionObserver" in window,
    });

    if (!active) {
      el.classList.add("reveal--in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("reveal--in");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={index ? ({ "--stagger-index": index, ...style } as React.CSSProperties) : style}
      {...rest}
    >
      {children}
    </div>
  );
}
