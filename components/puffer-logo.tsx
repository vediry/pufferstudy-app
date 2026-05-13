import * as React from "react";

export function PufferLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* body */}
      <circle cx="16" cy="17" r="11" fill="currentColor" />
      {/* spines */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="16" y1="3" x2="16" y2="7" />
        <line x1="6"  y1="9"  x2="9"  y2="11" />
        <line x1="26" y1="9"  x2="23" y2="11" />
        <line x1="3"  y1="20" x2="6.5" y2="20" />
        <line x1="29" y1="20" x2="25.5" y2="20" />
      </g>
      {/* eye highlight */}
      <circle cx="13" cy="15" r="2" fill="#fff" />
      <circle cx="13.5" cy="15.3" r="0.9" fill="#1F1B16" />
      {/* mouth */}
      <path
        d="M19 19 Q21 21 19 22"
        stroke="#1F1B16"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
