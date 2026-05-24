"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AssignmentsPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <Badge tone="accent" className="self-start">v3.0 · in design</Badge>
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Assignments
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Track what&apos;s due across subjects, with linked notes and cheat sheets.
        </p>
      </header>

      <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <ClipboardList className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h2
          className="text-[1.4rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Coming in v3.0
        </h2>
        <p className="max-w-md text-sm text-ink-muted">
          A unified inbox for every essay, problem set, lab, and project across your subjects.
          Due dates feed back into the Study Desk timeline so the soonest deadline always sits front and center.
        </p>
      </div>
    </div>
  );
}
