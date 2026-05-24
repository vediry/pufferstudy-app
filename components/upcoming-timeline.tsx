"use client";

import * as React from "react";
import Link from "next/link";
import { daysUntil, urgencyTier } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";
import type { Assignment } from "@/lib/cloud-assignments";

const WINDOW_DAYS = 21;

type Dot =
  | { kind: "subject"; id: string; name: string; days: number; tier: ReturnType<typeof urgencyTier> }
  | { kind: "assignment"; id: string; name: string; days: number; tier: ReturnType<typeof urgencyTier> };

type Props = {
  subjects: Subject[];
  assignments: Assignment[];
};

export function UpcomingTimeline({ subjects, assignments }: Props) {
  const now = new Date();

  const dots = React.useMemo<Dot[]>(() => {
    const subjectDots: Dot[] = subjects
      .filter((s) => !s.archived)
      .map((s) => {
        const d = daysUntil(s.testDate, now);
        return d !== null && d >= 0 && d <= WINDOW_DAYS
          ? ({ kind: "subject", id: s.id, name: s.name, days: d, tier: urgencyTier(s.testDate, now) } as Dot)
          : null;
      })
      .filter((x): x is Dot => x !== null);

    const assignmentDots: Dot[] = assignments
      .filter((a) => a.status !== "done")
      .map((a) => {
        const d = daysUntil(a.dueDate, now);
        return d !== null && d >= 0 && d <= WINDOW_DAYS
          ? ({ kind: "assignment", id: a.id, name: a.title, days: d, tier: urgencyTier(a.dueDate, now) } as Dot)
          : null;
      })
      .filter((x): x is Dot => x !== null);

    return [...subjectDots, ...assignmentDots];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, assignments]);

  return (
    <div className="glow-card border border-default bg-surface p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Upcoming · next 3 weeks</p>
        <Legend />
      </header>

      {dots.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">Nothing scheduled in the next 3 weeks.</p>
      ) : (
        <div className="relative pt-6 pb-9">
          {[
            { left: 0, label: "Today" },
            { left: 33, label: "+1 wk" },
            { left: 66, label: "+2 wks" },
            { left: 100, label: "+3 wks" },
          ].map(({ left, label }) => (
            <div
              key={left}
              className="absolute top-0 -translate-x-1/2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"
              style={{ left: `${left}%` }}
            >
              {label}
            </div>
          ))}
          <div className="relative h-[3px] bg-surface-3">
            {[0, 33, 66, 100].map((left) => (
              <div
                key={left}
                className="absolute w-px h-4 -top-1.5 bg-[color:var(--border-strong)]"
                style={{ left: `${left}%` }}
              />
            ))}
            {dots.map((dot) => {
              const left = (dot.days / WINDOW_DAYS) * 100;
              const dotColor =
                dot.tier === "urgent"
                  ? "var(--danger)"
                  : dot.tier === "warn"
                    ? "var(--warning)"
                    : "var(--accent)";
              const href =
                dot.kind === "subject" ? `/subjects/${dot.id}` : `/assignments`;
              const title =
                dot.kind === "subject"
                  ? `${dot.name} · in ${dot.days} day${dot.days === 1 ? "" : "s"}`
                  : `Assignment: ${dot.name} · in ${dot.days} day${dot.days === 1 ? "" : "s"}`;
              // Assignments use a square-ish shape; subjects stay circular.
              const isAssignment = dot.kind === "assignment";
              return (
                <React.Fragment key={`${dot.kind}-${dot.id}`}>
                  <Link
                    href={href}
                    className={`absolute -top-[7px] block h-4 w-4 -translate-x-1/2 border-[3px] border-[color:var(--surface)] shadow-soft ${
                      isAssignment ? "rounded-[4px]" : "rounded-full"
                    }`}
                    style={{ left: `${left}%`, background: dotColor }}
                    title={title}
                    aria-label={title}
                  />
                  <Link
                    href={href}
                    className="glow-on-hover absolute top-[18px] -translate-x-1/2 whitespace-nowrap rounded-full border border-default bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink"
                    style={{ left: `${left}%` }}
                  >
                    {dot.name}
                  </Link>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10.5px] text-ink-faint">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border-[2px] border-[color:var(--surface)]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        Test
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-[3px] border-[2px] border-[color:var(--surface)]"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
        Assignment
      </span>
    </div>
  );
}
