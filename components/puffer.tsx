"use client";

import * as React from "react";

type PufferProps = {
  /** Rendered width & height in px. */
  size?: number;
  /** `happy` adds a gentle bounce + accent glow halo (for celebrations). */
  mood?: "idle" | "happy";
  className?: string;
  alt?: string;
};

/**
 * The PufferStudy mascot — a self-contained, theme-colored pufferfish drawn as
 * inline SVG (no raster asset). Body/spikes follow the active theme's accent
 * tokens so it recolors automatically per theme. Presentational only.
 *
 * `mood="happy"` applies the `.puffer-happy` class (defined in globals.css):
 * a gentle bounce/wiggle plus an accent-colored drop-shadow halo. The bounce
 * respects `prefers-reduced-motion`; the static halo always renders.
 *
 * This is a "for now" placeholder mascot — swap the artwork later by replacing
 * the SVG body below (the public API / call sites stay the same).
 */
export function Puffer({ size = 96, mood = "idle", className, alt = "Puffer" }: PufferProps) {
  const moodClass = mood === "happy" ? "puffer-happy" : undefined;
  const mergedClass = [moodClass, className].filter(Boolean).join(" ") || undefined;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={alt}
      data-mood={mood}
      className={mergedClass}
      style={{ display: "block" }}
    >
      {/* Spiky silhouette (drawn behind the body so spikes poke out). */}
      <polygon points={SPIKES} fill="var(--accent-deep)" opacity="0.9" />

      {/* Side fins, tucked behind the body. */}
      <path d="M24 60 q-14 -4 -16 8 q12 5 17 1 z" fill="var(--accent-deep)" />
      <path d="M96 60 q14 -4 16 8 q-12 5 -17 1 z" fill="var(--accent-deep)" />

      {/* Body. */}
      <circle cx="60" cy="62" r="39" fill="var(--accent)" />

      {/* Soft belly highlight. */}
      <ellipse cx="60" cy="77" rx="27" ry="18" fill="var(--surface)" opacity="0.5" />

      {/* Cheeks. */}
      <circle cx="41" cy="69" r="4.5" fill="var(--accent-light)" opacity="0.75" />
      <circle cx="79" cy="69" r="4.5" fill="var(--accent-light)" opacity="0.75" />

      {/* Eyes. */}
      <circle cx="48" cy="55" r="8.5" fill="#fff" />
      <circle cx="72" cy="55" r="8.5" fill="#fff" />
      <circle cx="50" cy="56.5" r="4.2" fill="#1F1B16" />
      <circle cx="74" cy="56.5" r="4.2" fill="#1F1B16" />
      <circle cx="51.6" cy="54.6" r="1.5" fill="#fff" />
      <circle cx="75.6" cy="54.6" r="1.5" fill="#fff" />

      {/* Little smile. */}
      <path
        d="M54 71 q6 6 12 0"
        stroke="#1F1B16"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 14-point star points for the pufferfish spikes, computed once. Inner radius
 * matches the body circle (39); outer radius (50) is how far the spikes poke
 * out past the body. Centered on (60, 62) to match the body.
 */
const SPIKES = (() => {
  const cx = 60;
  const cy = 62;
  const outer = 50;
  const inner = 39;
  const count = 14;
  const pts: string[] = [];
  for (let i = 0; i < count * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / count) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(" ");
})();
