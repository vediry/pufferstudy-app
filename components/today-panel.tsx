"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pickSoonestSubject, urgencyTier, daysUntil } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

type Props = {
  subjects: Subject[];
};

export function TodayPanel({ subjects }: Props) {
  const focus = React.useMemo(() => pickSoonestSubject(subjects), [subjects]);

  if (!focus) {
    return (
      <div className="glow-card border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</p>
        <h2
          className="mb-1.5 text-[1.4rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Nothing scheduled yet
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Add a subject and a test date to see what to study next.
        </p>
        <Button asChild>
          <Link href="/subjects/new">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add your first subject
          </Link>
        </Button>
      </div>
    );
  }

  const days = daysUntil(focus.testDate);
  const tier = urgencyTier(focus.testDate);
  const badgeTone =
    tier === "urgent" ? "danger" : tier === "warn" ? "warning" : "accent";
  const dayCopy = days === null ? "" : days === 0 ? "Today" : days === 1 ? "1 day away" : `${days} days away`;

  return (
    <div className="glow-card border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</p>
      <Badge tone={badgeTone}>{dayCopy}</Badge>
      <h2
        className="mt-3 text-[1.5rem] leading-tight text-ink"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {focus.name}{focus.testLabel ? ` — ${focus.testLabel}` : ""}
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        {focus.fileCount} {focus.fileCount === 1 ? "file" : "files"}
        {focus.cheatsheetGeneratedAt ? " · sheet ready" : ""}
      </p>
      <Button asChild className="w-full">
        <Link href={`/subjects/${focus.id}`}>
          Open subject
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
    </div>
  );
}
