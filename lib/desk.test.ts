import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sortSubjects,
  filterSubjects,
  pickSoonestSubject,
  urgencyTier,
  formatRelativeTime,
} from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

function s(overrides: Partial<Subject> = {}): Subject {
  return {
    id: overrides.id ?? "subj_x",
    name: overrides.name ?? "Subject",
    testLabel: overrides.testLabel ?? null,
    testDate: overrides.testDate ?? null,
    cheatsheetMarkdown: overrides.cheatsheetMarkdown ?? null,
    cheatsheetGeneratedAt: overrides.cheatsheetGeneratedAt ?? null,
    studyGuideMarkdown: overrides.studyGuideMarkdown ?? null,
    studyGuideGeneratedAt: overrides.studyGuideGeneratedAt ?? null,
    chatMessages: overrides.chatMessages ?? [],
    archived: overrides.archived ?? false,
    fileCount: overrides.fileCount ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const NOW = new Date("2026-05-21T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sortSubjects", () => {
  it("urgency: subjects with testDate come first, soonest first; no-date last", () => {
    const a = s({ id: "a", name: "A", testDate: "2026-05-25" });
    const b = s({ id: "b", name: "B", testDate: "2026-05-22" });
    const c = s({ id: "c", name: "C", testDate: null });
    const result = sortSubjects([a, b, c], "urgency");
    expect(result.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("recent: by updatedAt DESC", () => {
    const a = s({ id: "a", updatedAt: "2026-05-20T00:00:00.000Z" });
    const b = s({ id: "b", updatedAt: "2026-05-21T00:00:00.000Z" });
    expect(sortSubjects([a, b], "recent").map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("alpha: by name ASC, case-insensitive", () => {
    const a = s({ id: "a", name: "biology" });
    const b = s({ id: "b", name: "Algebra" });
    expect(sortSubjects([a, b], "alpha").map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("filterSubjects", () => {
  const subjects = [
    s({ id: "a", name: "Biology", testLabel: "Final exam" }),
    s({ id: "b", name: "US History", testLabel: "Unit 4 quiz" }),
    s({ id: "c", name: "Algebra II", testLabel: null }),
  ];

  it("empty query returns all", () => {
    expect(filterSubjects(subjects, "").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("matches subject name (case-insensitive)", () => {
    expect(filterSubjects(subjects, "bio").map((x) => x.id)).toEqual(["a"]);
  });

  it("matches testLabel", () => {
    expect(filterSubjects(subjects, "quiz").map((x) => x.id)).toEqual(["b"]);
  });

  it("trims whitespace", () => {
    expect(filterSubjects(subjects, "  bio  ").map((x) => x.id)).toEqual(["a"]);
  });

  it("returns empty for unmatched", () => {
    expect(filterSubjects(subjects, "zebra")).toEqual([]);
  });
});

describe("pickSoonestSubject", () => {
  it("returns null when list is empty", () => {
    expect(pickSoonestSubject([])).toBeNull();
  });

  it("returns null when no subject has a future testDate", () => {
    expect(pickSoonestSubject([s({ testDate: null })])).toBeNull();
    expect(pickSoonestSubject([s({ testDate: "2026-01-01" })])).toBeNull();
  });

  it("picks the subject with the soonest future testDate", () => {
    const subjects = [
      s({ id: "a", testDate: "2026-05-30" }),
      s({ id: "b", testDate: "2026-05-22" }),
      s({ id: "c", testDate: "2026-06-10" }),
    ];
    expect(pickSoonestSubject(subjects)?.id).toBe("b");
  });

  it("skips archived subjects", () => {
    const subjects = [
      s({ id: "a", testDate: "2026-05-22", archived: true }),
      s({ id: "b", testDate: "2026-05-25", archived: false }),
    ];
    expect(pickSoonestSubject(subjects)?.id).toBe("b");
  });
});

describe("urgencyTier", () => {
  it("urgent for ≤3 days", () => {
    expect(urgencyTier("2026-05-22")).toBe("urgent");
    expect(urgencyTier("2026-05-24")).toBe("urgent");
  });
  it("warn for 4–7 days", () => {
    expect(urgencyTier("2026-05-25")).toBe("warn");
    expect(urgencyTier("2026-05-28")).toBe("warn");
  });
  it("ok for 8–14 days", () => {
    expect(urgencyTier("2026-06-04")).toBe("ok");
  });
  it("neutral beyond 14 days", () => {
    expect(urgencyTier("2026-06-05")).toBe("neutral");
  });
  it("neutral when no date", () => {
    expect(urgencyTier(null)).toBe("neutral");
  });
});

describe("formatRelativeTime", () => {
  it("uses 'just now' for <60s", () => {
    expect(formatRelativeTime("2026-05-21T11:59:30.000Z")).toBe("just now");
  });
  it("uses minutes for <1h same-day", () => {
    expect(formatRelativeTime("2026-05-21T11:30:00.000Z")).toBe("30 min ago");
  });
  it("uses hours for same-day >=1h", () => {
    expect(formatRelativeTime("2026-05-21T09:00:00.000Z")).toBe("3 hours ago");
  });
  it("uses 'Yesterday · TIME' for previous calendar day", () => {
    const out = formatRelativeTime("2026-05-20T16:12:00.000Z");
    expect(out.startsWith("Yesterday ·")).toBe(true);
  });
  it("uses date only for >7 days", () => {
    const out = formatRelativeTime("2026-05-13T00:00:00.000Z");
    expect(out).toMatch(/May 13|13 May|May 12/);
  });
});
