"use client";

import * as React from "react";
import Link from "next/link";
import { daysUntil, urgencyTier } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

const WINDOW_DAYS = 21;

type Props = {
  subjects: Subject[];
};

export function UpcomingTimeline({ subjects }: Props) {
  const now = new Date();

  const dots = React.useMemo(() => {
    return subjects
      .filter((s) => !s.archived)
      .map((s) => {
        const d = daysUntil(s.testDate, now);
        return d !== null && d >= 0 && d <= WINDOW_DAYS
          ? { subject: s, days: d, tier: urgencyTier(s.testDate, now) }
          : null;
      })
      .filter((x): x is { subject: Subject; days: number; tier: ReturnType<typeof urgencyTier> } => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  return (
    <div className="glow-card border border-default bg-surface p-5">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Upcoming · next 3 weeks</p>

      {dots.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">No tests scheduled in the next 3 weeks.</p>
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
            {dots.map(({ subject, days, tier }) => {
              const left = (days / WINDOW_DAYS) * 100;
              const dotColor =
                tier === "urgent"
                  ? "var(--danger)"
                  : tier === "warn"
                  ? "var(--warning)"
                  : "var(--accent)";
              return (
                <React.Fragment key={subject.id}>
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="absolute -top-[7px] block h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--surface)] shadow-soft"
                    style={{ left: `${left}%`, background: dotColor }}
                    title={`${subject.name} · in ${days} day${days === 1 ? "" : "s"}`}
                  />
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="absolute top-[18px] -translate-x-1/2 whitespace-nowrap border border-default bg-surface px-1 py-0.5 text-[11px] font-semibold text-ink"
                    style={{ left: `${left}%` }}
                  >
                    {subject.name}
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
