"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ORDER = ["light", "dark", "system"] as const;
type Mode = (typeof ORDER)[number];

const ICONS: Record<Mode, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABEL: Record<Mode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const current = (mounted ? (theme as Mode) : "system") ?? "system";
  const Icon = ICONS[current] ?? Monitor;

  function cycle() {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${LABEL[current]}. Click to change.`}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border border-default text-ink-muted",
        "transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </button>
  );
}
