"use client";

import Link from "next/link";
import { BookOpen, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countdownLabel, countdownTone, daysUntil } from "@/lib/utils";
import type { Subject } from "@/lib/cloud-subjects";

type Props = {
  subject: Subject;
  fileCount?: number;
};

export function SubjectCard({ subject, fileCount = 0 }: Props) {
  const days = daysUntil(subject.testDate);
  const tone = countdownTone(days);
  const label = countdownLabel(days);

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-default bg-surface p-5 shadow-soft transition-all hover:-translate-y-[1px] hover:border-strong hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)]/12 text-[var(--primary)]">
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold leading-tight tracking-tight text-ink">
          {subject.name}
        </h3>
        {subject.testLabel ? (
          <p className="text-sm text-ink-muted">{subject.testLabel}</p>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-2 text-sm text-ink-faint">
        <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
        <span className="tabular">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
      </div>
    </Link>
  );
}
