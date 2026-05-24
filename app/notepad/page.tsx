"use client";

import * as React from "react";
import { NotebookPen } from "lucide-react";

export default function NotepadPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-1">
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Notepad
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Quick thoughts, scratch notes, and anything that doesn&apos;t belong to a subject yet.
        </p>
      </header>

      <div className="glow-card border border-default bg-surface p-8">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default bg-surface-2 text-[color:var(--accent-deep)]">
            <NotebookPen className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h2
            className="text-[1.4rem] leading-tight"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            Notepad is coming soon
          </h2>
          <p className="max-w-md text-sm text-ink-muted">
            A focused, distraction-free place to jot down ideas without committing them to a subject.
            For now this is a placeholder while we wire up the editor.
          </p>
        </div>
      </div>
    </div>
  );
}
