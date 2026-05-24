import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "danger" | "warning" | "success" | "past" | "accent";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-default text-ink-muted",
  danger:  "border-[color:var(--danger)] text-[color:var(--danger)]",
  warning: "border-[color:var(--warning)] text-[color:var(--warning)]",
  success: "border-[color:var(--success)] text-[color:var(--success)]",
  past:    "border-default text-ink-faint",
  accent:  "border-[color:var(--accent)] text-[color:var(--accent)]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-[color:var(--surface)]/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider tabular backdrop-blur-sm",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
