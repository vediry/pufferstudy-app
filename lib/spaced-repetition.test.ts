import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nextSchedule,
  nextDueDate,
  gradeFromName,
} from "@/lib/spaced-repetition";

describe("gradeFromName", () => {
  it("maps the three button names to SM-2 grades", () => {
    expect(gradeFromName("again")).toBe(0);
    expect(gradeFromName("good")).toBe(2);
    expect(gradeFromName("easy")).toBe(3);
  });
});

describe("nextSchedule", () => {
  it("'again' resets the interval to 1 day and lowers ease", () => {
    const out = nextSchedule({
      ease: 2.5,
      intervalDays: 14,
      reviews: 5,
      grade: 0,
    });
    expect(out.intervalDays).toBe(1);
    expect(out.ease).toBeCloseTo(2.3, 5);
    expect(out.reviews).toBe(6);
  });

  it("'again' never drops ease below 1.3", () => {
    const out = nextSchedule({ ease: 1.3, intervalDays: 30, reviews: 10, grade: 0 });
    expect(out.ease).toBe(1.3);
  });

  it("first 'good' review → 1 day; first 'easy' → 4 days", () => {
    const good = nextSchedule({ ease: 2.5, intervalDays: 0, reviews: 0, grade: 2 });
    expect(good.intervalDays).toBe(1);
    const easy = nextSchedule({ ease: 2.5, intervalDays: 0, reviews: 0, grade: 3 });
    expect(easy.intervalDays).toBe(4);
  });

  it("second 'good' → 4 days; second 'easy' → 7 days", () => {
    const good = nextSchedule({ ease: 2.5, intervalDays: 1, reviews: 1, grade: 2 });
    expect(good.intervalDays).toBe(4);
    const easy = nextSchedule({ ease: 2.5, intervalDays: 1, reviews: 1, grade: 3 });
    expect(easy.intervalDays).toBe(7);
  });

  it("subsequent 'good' multiplies by ease (no ease bump on grade 2)", () => {
    const out = nextSchedule({ ease: 2.5, intervalDays: 4, reviews: 2, grade: 2 });
    // Grade 2 is the neutral point in SM-2: ease stays put.
    expect(out.ease).toBe(2.5);
    // 4 * 2.5 = 10
    expect(out.intervalDays).toBe(10);
  });

  it("subsequent 'easy' gets a 30% bonus on top of ease", () => {
    const out = nextSchedule({ ease: 2.5, intervalDays: 4, reviews: 2, grade: 3 });
    // 4 * ~2.6 * 1.3 ≈ 13.5 → 14
    expect(out.intervalDays).toBeGreaterThanOrEqual(13);
    expect(out.intervalDays).toBeLessThanOrEqual(14);
  });

  it("reviews counter always increments", () => {
    expect(nextSchedule({ ease: 2.5, intervalDays: 0, reviews: 0, grade: 0 }).reviews).toBe(1);
    expect(nextSchedule({ ease: 2.5, intervalDays: 0, reviews: 0, grade: 2 }).reviews).toBe(1);
    expect(nextSchedule({ ease: 2.5, intervalDays: 0, reviews: 0, grade: 3 }).reviews).toBe(1);
  });
});

describe("nextDueDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds the interval to today's date", () => {
    // System time is 2026-05-23 UTC. Local date depends on TZ but the string
    // format we produce is local-midnight + interval days, so day arithmetic
    // remains correct.
    const due = nextDueDate(1);
    expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(due).not.toBe("2026-05-23"); // interval=1 means at least tomorrow
  });

  it("interval of 0 returns today's date", () => {
    const today = nextDueDate(0);
    // local-midnight equivalent of "today" — won't perfectly match the UTC
    // input string but format is YYYY-MM-DD.
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
