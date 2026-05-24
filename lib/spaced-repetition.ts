/**
 * Simplified SM-2 spaced repetition.
 *
 * Users see 3 buttons (Again / Good / Easy) which map to grades 0, 2, 3.
 * (We skip "Hard"/grade 1 — four buttons is too many to choose from quickly,
 * and the practical gap between Good and Hard is small for self-study.)
 *
 * State per card:
 *   - ease: SM-2 ease factor, clamped to [1.3, ∞]
 *   - intervalDays: days between this review and the next
 *   - reviews: how many times the card has been reviewed
 *   - dueDate: next time this card should appear (YYYY-MM-DD)
 */

export type Grade = 0 | 2 | 3; // Again / Good / Easy
export type GradeName = "again" | "good" | "easy";

export function gradeFromName(name: GradeName): Grade {
  if (name === "again") return 0;
  if (name === "good") return 2;
  return 3;
}

export type CardState = {
  ease: number;
  intervalDays: number;
  reviews: number;
};

export type ScheduleInput = CardState & { grade: Grade };

export type ScheduleOutput = {
  ease: number;
  intervalDays: number;
  reviews: number;
};

const MIN_EASE = 1.3;

export function nextSchedule(input: ScheduleInput): ScheduleOutput {
  const { grade, ease, intervalDays, reviews } = input;

  // Forgot → reset interval, lower ease (but not below MIN_EASE).
  if (grade === 0) {
    return {
      ease: Math.max(MIN_EASE, ease - 0.2),
      intervalDays: 1,
      reviews: reviews + 1,
    };
  }

  // Adjust ease based on grade (SM-2 formula).
  // grade 2 → ~no change, grade 3 → bump
  const newEase = Math.max(
    MIN_EASE,
    ease + (0.1 - (3 - grade) * (0.08 + (3 - grade) * 0.02)),
  );

  // Interval progression:
  //   first correct review → 1 day
  //   second correct review → 4 days (Good) or 6 days (Easy)
  //   subsequent → previous * ease, with Easy bonus
  let newInterval: number;
  if (reviews === 0) {
    newInterval = grade === 3 ? 4 : 1;
  } else if (reviews === 1) {
    newInterval = grade === 3 ? 7 : 4;
  } else {
    const base = Math.max(1, intervalDays) * newEase;
    newInterval = Math.round(grade === 3 ? base * 1.3 : base);
  }

  return {
    ease: newEase,
    intervalDays: newInterval,
    reviews: reviews + 1,
  };
}

/**
 * Compute the next due date as YYYY-MM-DD given today + interval.
 * Uses local-midnight semantics so "in 1 day" means tomorrow's calendar date.
 */
export function nextDueDate(intervalDays: number, today: Date = new Date()): string {
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  next.setDate(next.getDate() + intervalDays);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
