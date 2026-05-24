"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function FlashcardsPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <Badge tone="accent" className="self-start">v3.1 · planned</Badge>
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Flashcards
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Auto-generated decks from your cheat sheets, with spaced repetition.
        </p>
      </header>

      <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <Layers className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h2
          className="text-[1.4rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Coming in v3.1
        </h2>
        <p className="max-w-md text-sm text-ink-muted">
          One tap to turn any cheat sheet into a flashcard deck. PufferStudy schedules reviews so
          terms you know fade out and the wobbly ones come back tomorrow.
        </p>
      </div>
    </div>
  );
}
