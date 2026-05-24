"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pickSoonestSubject, urgencyTier, daysUntil } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";
import type { Assignment } from "@/lib/cloud-assignments";

type Props = {
  subjects: Subject[];
  assignments: Assignment[];
};

type Focus =
  | { kind: "subject"; subject: Subject; days: number | null }
  | { kind: "assignment"; assignment: Assignment; days: number | null };

function pickSoonestFocus(
  subjects: Subject[],
  assignments: Assignment[],
): Focus | null {
  const focusSubject = pickSoonestSubject(subjects);
  const subjectDays = focusSubject ? daysUntil(focusSubject.testDate) : null;

  const futureAssignments = assignments
    .filter((a) => a.status !== "done")
    .map((a) => ({ a, d: daysUntil(a.dueDate) }))
    .filter((x): x is { a: Assignment; d: number } => x.d !== null && x.d >= 0)
    .sort((x, y) => x.d - y.d);
  const focusAssignment = futureAssignments[0] ?? null;

  if (!focusSubject && !focusAssignment) return null;
  if (!focusAssignment) return { kind: "subject", subject: focusSubject!, days: subjectDays };
  if (!focusSubject) return { kind: "assignment", assignment: focusAssignment.a, days: focusAssignment.d };

  // Both exist — pick whichever is soonest.
  if (subjectDays === null) return { kind: "assignment", assignment: focusAssignment.a, days: focusAssignment.d };
  return subjectDays <= focusAssignment.d
    ? { kind: "subject", subject: focusSubject, days: subjectDays }
    : { kind: "assignment", assignment: focusAssignment.a, days: focusAssignment.d };
}

function dayCopy(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "1 day away";
  return `${days} days away`;
}

export function TodayPanel({ subjects, assignments }: Props) {
  const focus = React.useMemo(
    () => pickSoonestFocus(subjects, assignments),
    [subjects, assignments],
  );

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
          Add a subject + test date, or an assignment with a due date.
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

  if (focus.kind === "subject") {
    const tier = urgencyTier(focus.subject.testDate);
    const badgeTone =
      tier === "urgent" ? "danger" : tier === "warn" ? "warning" : "accent";

    return (
      <div className="glow-card border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today · test</p>
        <Badge tone={badgeTone}>{dayCopy(focus.days)}</Badge>
        <h2
          className="mt-3 text-[1.5rem] leading-tight text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {focus.subject.name}{focus.subject.testLabel ? ` — ${focus.subject.testLabel}` : ""}
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          {focus.subject.fileCount} {focus.subject.fileCount === 1 ? "file" : "files"}
          {focus.subject.cheatsheetGeneratedAt ? " · sheet ready" : ""}
        </p>
        <Button asChild className="w-full">
          <Link href={`/subjects/${focus.subject.id}`}>
            Open subject
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
      </div>
    );
  }

  // Assignment focus
  const tier =
    focus.days !== null && focus.days <= 3
      ? "urgent"
      : focus.days !== null && focus.days <= 7
        ? "warn"
        : "neutral";
  const badgeTone =
    tier === "urgent" ? "danger" : tier === "warn" ? "warning" : "accent";

  return (
    <div className="glow-card border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today · assignment</p>
      <Badge tone={badgeTone}>{dayCopy(focus.days)}</Badge>
      <h2
        className="mt-3 text-[1.5rem] leading-tight text-ink"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {focus.assignment.title}
      </h2>
      {focus.assignment.description ? (
        <p className="mt-1 mb-4 line-clamp-2 text-sm text-ink-muted">
          {focus.assignment.description}
        </p>
      ) : (
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Status: {focus.assignment.status.replace("_", " ")}
        </p>
      )}
      <Button asChild variant="secondary" className="w-full">
        <Link href="/assignments">
          <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
          Open assignments
        </Link>
      </Button>
    </div>
  );
}
