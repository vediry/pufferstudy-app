import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockListActivity, mockAuth } = vi.hoisted(() => ({
  mockListActivity: vi.fn(),
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/activity", () => ({
  listActivity: mockListActivity,
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

import { GET } from "@/app/api/activity/route";

describe("GET /api/activity", () => {
  beforeEach(() => {
    mockListActivity.mockReset();
    mockAuth.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = new Request("http://localhost/api/activity");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns events for the current user with default limit", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    const sampleEvents = [
      {
        id: 1,
        subjectId: "s1",
        subjectName: "Bio",
        type: "cheatsheet_generated",
        data: {},
        createdAt: "2026-05-21T00:00:00.000Z",
      },
    ];
    mockListActivity.mockResolvedValue(sampleEvents);
    const req = new Request("http://localhost/api/activity");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ events: sampleEvents });
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 10);
  });

  it("respects ?limit query parameter", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    mockListActivity.mockResolvedValue([]);
    const req = new Request("http://localhost/api/activity?limit=25");
    await GET(req);
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 25);
  });

  it("falls back to 10 when limit is not a positive integer", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    mockListActivity.mockResolvedValue([]);
    const req = new Request("http://localhost/api/activity?limit=garbage");
    await GET(req);
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 10);
  });
});
