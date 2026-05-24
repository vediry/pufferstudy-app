"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PracticePage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <Badge tone="accent" className="self-start">v3.3 · planned</Badge>
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Practice
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          AI-generated practice questions and quizzes from your cheat sheets.
        </p>
      </header>

      <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h2
          className="text-[1.4rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Coming in v3.3
        </h2>
        <p className="max-w-md text-sm text-ink-muted">
          Multiple choice, short answer, and free-response prompts pulled straight from your sheet.
          Self-graded, with explanations for the misses so you actually learn the gap.
        </p>
      </div>
    </div>
  );
}
