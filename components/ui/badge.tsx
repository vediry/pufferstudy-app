import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success" | "past";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  danger:  "bg-[var(--danger)] text-white",
  warning: "bg-[var(--warning)] text-white",
  success: "bg-[var(--success)] text-white",
  past:    "bg-surface-2 text-ink-faint",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tabular",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
