import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  // The server returns DATE as ISO string with UTC midnight (e.g. "2026-05-25T00:00:00.000Z").
  // Parsing that directly shifts to the previous day in negative-UTC timezones.
  // Take only the YYYY-MM-DD prefix and construct a LOCAL-midnight Date to avoid the shift.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  const test = new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((test.getTime() - today.getTime()) / MS_PER_DAY);
}

export type CountdownTone = "danger" | "warning" | "neutral" | "past";

export function countdownTone(days: number | null): CountdownTone {
  if (days === null) return "neutral";
  if (days < 0) return "past";
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "neutral";
}

export function countdownLabel(days: number | null): string {
  if (days === null) return "no test set";
  if (days < 0) return "past";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
