"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const urgencyClass =
    tier === "urgent"
      ? "bg-[color:var(--danger)] text-white"
      : tier === "warn"
      ? "bg-[color:var(--warning)] text-white"
      : "bg-[color:var(--accent)] text-[color:var(--primary-foreground)]";

  const dayCopy = days === null ? "" : days === 0 ? "Today" : days === 1 ? "1 day away" : `${days} days away`;

  return (
    <div className="glow-card border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</p>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${urgencyClass}`}
      >
        {tier === "urgent" ? "🔥 " : ""}{dayCopy}
      </span>
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
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link href={`/subjects/${focus.id}`}>
            Open subject
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/subjects/${focus.id}/cheatsheet`}>
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
            Chat
          </Link>
        </Button>
      </div>
    </div>
  );
}
