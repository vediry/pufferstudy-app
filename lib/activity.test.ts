import { describe, it, expect, vi, beforeEach } from "vitest";

// `server-only` is a build-time guard with no node export; stub it.
vi.mock("server-only", () => ({}));

// Mock @vercel/postgres so the test runs in node env without a DB.
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(async () => ({ rows: [] })),
}));

import { sql } from "@vercel/postgres";
import { logActivity } from "@/lib/activity";

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a row with userId, subjectId, type, and data", async () => {
    await logActivity({
      userId: "user_abc",
      subjectId: "subj_1",
      type: "cheatsheet_generated",
      data: { sourceFileCount: 3 },
    });
    expect(sql).toHaveBeenCalledTimes(1);
    const callArgs = (sql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const interpolations = callArgs.slice(1);
    expect(interpolations).toEqual([
      "user_abc",
      "subj_1",
      "cheatsheet_generated",
      JSON.stringify({ sourceFileCount: 3 }),
    ]);
  });

  it("accepts a null subjectId for user-level events", async () => {
    await logActivity({
      userId: "user_abc",
      subjectId: null,
      type: "subject_created",
      data: { name: "Biology" },
    });
    const callArgs = (sql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const interpolations = callArgs.slice(1);
    expect(interpolations[1]).toBeNull();
  });

  it("swallows DB errors (fire-and-forget)", async () => {
    (sql as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    await expect(
      logActivity({
        userId: "u",
        subjectId: "s",
        type: "cheatsheet_generated",
        data: {},
      }),
    ).resolves.toBeUndefined();
  });
});
