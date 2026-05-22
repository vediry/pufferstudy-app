"use client";

import Link from "next/link";
import { BookOpen, ImageIcon, MessageSquare, RotateCcw, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countdownLabel, countdownTone, daysUntil } from "@/lib/utils";
import type { Subject } from "@/lib/cloud-subjects";

type Props = {
  subject: Subject;
  onChat?: (subject: Subject) => void;
  onRegenerate?: (subject: Subject) => void;
  onArchive?: (subject: Subject) => void;
};

export function SubjectCard({ subject, onChat, onRegenerate, onArchive }: Props) {
  const days = daysUntil(subject.testDate);
  const tone = countdownTone(days);
  const label = countdownLabel(days);

  return (
    <div className="group relative flex flex-col gap-3 border border-default bg-surface p-5 transition-all hover:-translate-y-[1px] hover:border-strong">
      <Link
        href={`/subjects/${subject.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${subject.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="relative z-10 flex flex-col gap-1">
        <h3
          className="text-[1.2rem] leading-tight tracking-tight text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {subject.name}
        </h3>
        {subject.testLabel ? (
          <p className="text-sm text-ink-muted">{subject.testLabel}</p>
        ) : null}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-default pt-3 text-sm">
        <span className="flex items-center gap-1.5 text-ink-faint">
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
          <span className="tabular">
            {subject.fileCount} {subject.fileCount === 1 ? "file" : "files"}
          </span>
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onChat ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChat(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title="Open chat"
              aria-label={`Open chat for ${subject.name}`}
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRegenerate(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title="Regenerate cheat sheet"
              aria-label={`Regenerate cheat sheet for ${subject.name}`}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {onArchive ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title={subject.archived ? "Unarchive" : "Archive"}
              aria-label={subject.archived ? `Unarchive ${subject.name}` : `Archive ${subject.name}`}
            >
              <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
