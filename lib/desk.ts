import type { Subject } from "@/lib/cloud-subjects";

export type SortMode = "urgency" | "recent" | "alpha";
export type Urgency = "urgent" | "warn" | "ok" | "neutral";

const DAY_MS = 1000 * 60 * 60 * 24;

export function daysUntil(testDate: string | null, now: Date = new Date()): number | null {
  if (!testDate) return null;
  // The DB returns DATE as ISO with UTC midnight; parsing directly shifts to the
  // previous day in negative-UTC timezones. Pull YYYY-MM-DD and build a local-
  // midnight Date so the count matches what users would say (mirrors lib/utils.ts).
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(testDate);
  if (!match) return null;
  const target = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / DAY_MS);
}

export function urgencyTier(testDate: string | null, now: Date = new Date()): Urgency {
  const days = daysUntil(testDate, now);
  if (days === null) return "neutral";
  if (days <= 3) return "urgent";
  if (days <= 7) return "warn";
  if (days <= 14) return "ok";
  return "neutral";
}

export function sortSubjects(subjects: Subject[], mode: SortMode, now: Date = new Date()): Subject[] {
  const copy = subjects.slice();
  if (mode === "urgency") {
    copy.sort((a, b) => {
      const da = daysUntil(a.testDate, now);
      const db = daysUntil(b.testDate, now);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  } else if (mode === "recent") {
    copy.sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : b.updatedAt > a.updatedAt ? 1 : 0));
  } else {
    copy.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }
  return copy;
}

export function filterSubjects(subjects: Subject[], query: string): Subject[] {
  const q = query.trim().toLowerCase();
  if (!q) return subjects;
  return subjects.filter((s) => {
    const name = s.name.toLowerCase();
    const label = (s.testLabel ?? "").toLowerCase();
    return name.includes(q) || label.includes(q);
  });
}

export function pickSoonestSubject(subjects: Subject[], now: Date = new Date()): Subject | null {
  const future = subjects.filter((s) => {
    if (s.archived) return false;
    const days = daysUntil(s.testDate, now);
    return days !== null && days >= 0;
  });
  if (future.length === 0) return null;
  return future.reduce((best, s) => {
    const dBest = daysUntil(best.testDate, now)!;
    const dS = daysUntil(s.testDate, now)!;
    return dS < dBest ? s : best;
  });
}

/**
 * Calendar-aware relative time. Uses minute/hour grain for same-day events,
 * "Yesterday · TIME" for the previous calendar day, "N days ago" up to a
 * week, then a short localized date.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const calendarDays = Math.round((nowDay - dDay) / DAY_MS);

  if (calendarDays === 0) {
    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  }
  if (calendarDays === 1) {
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Yesterday · ${time}`;
  }
  if (calendarDays < 7) return `${calendarDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
