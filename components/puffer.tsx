"use client";

import * as React from "react";

type PufferProps = {
  /** Rendered width & height in px. */
  size?: number;
  /** Reserved for a future second pose; both render the same asset today. */
  mood?: "idle" | "happy";
  className?: string;
  alt?: string;
};

/**
 * The PufferStudy mascot. Renders the user-supplied artwork from
 * `public/puffer.png`; if that ever fails to load it falls back to a
 * self-contained inline SVG so a mascot always shows. Presentational only.
 */
export function Puffer({ size = 96, mood = "idle", className, alt = "Puffer" }: PufferProps) {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return <PufferFallback size={size} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- single static mascot, sized inline
    <img
      src="/puffer.png"
      width={size}
      height={size}
      alt={alt}
      data-mood={mood}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

function PufferFallback({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <g transform="translate(40 40)">
        <circle r="30" fill="var(--primary)" />
        <g stroke="var(--primary)" strokeWidth="3" strokeLinecap="round">
          <line x1="0" y1="-36" x2="0" y2="-30" />
          <line x1="25" y1="-21" x2="21" y2="-17" />
          <line x1="-25" y1="-21" x2="-21" y2="-17" />
          <line x1="36" y1="0" x2="30" y2="0" />
          <line x1="-36" y1="0" x2="-30" y2="0" />
          <line x1="25" y1="21" x2="21" y2="17" />
          <line x1="-25" y1="21" x2="-21" y2="17" />
          <line x1="0" y1="36" x2="0" y2="30" />
        </g>
        <circle cx="-8" cy="-4" r="5" fill="#fff" />
        <circle cx="-6.5" cy="-3" r="2.2" fill="#1F1B16" />
        <path d="M5 5 Q11 11 5 15" stroke="#1F1B16" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
