import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/60 px-6 py-16 text-center">
      <PufferIllustration />
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          No subjects yet
        </h2>
        <p className="max-w-md text-[15px] text-ink-muted">
          Add a class or unit, then upload photos of your notes. When test day comes,
          PufferStudy turns it all into a tidy cheat sheet.
        </p>
      </div>
      <Button asChild>
        <Link href="/subjects/new">
          <Plus />
          New subject
        </Link>
      </Button>
    </div>
  );
}

function PufferIllustration() {
  return (
    <svg
      viewBox="0 0 200 140"
      width={160}
      height={112}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* paper */}
      <rect x="20" y="22" width="120" height="100" rx="8" fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="1.5" />
      <line x1="32" y1="44" x2="128" y2="44" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="56" x2="116" y2="56" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="68" x2="124" y2="68" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="80" x2="100" y2="80" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="32" y1="92" x2="120" y2="92" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />

      {/* puffer */}
      <g transform="translate(122 64)">
        <circle r="32" fill="var(--primary)" />
        <g stroke="var(--primary)" strokeWidth="3" strokeLinecap="round">
          <line x1="0" y1="-38" x2="0" y2="-32" />
          <line x1="26" y1="-22" x2="22" y2="-18" />
          <line x1="-26" y1="-22" x2="-22" y2="-18" />
          <line x1="38" y1="0" x2="32" y2="0" />
          <line x1="-38" y1="0" x2="-32" y2="0" />
          <line x1="26" y1="22" x2="22" y2="18" />
          <line x1="-26" y1="22" x2="-22" y2="18" />
          <line x1="0" y1="38" x2="0" y2="32" />
        </g>
        <circle cx="-8" cy="-4" r="5.5" fill="#fff" />
        <circle cx="-6.5" cy="-3" r="2.4" fill="#1F1B16" />
        <path d="M6 4 Q12 10 6 14" stroke="#1F1B16" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
