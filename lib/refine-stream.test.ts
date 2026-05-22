import { describe, it, expect, vi } from "vitest";
import { TagParser, capHistory, looksLikeSheet, type ParserHandlers } from "@/lib/refine-stream";
import type { ChatMessage } from "@/types";

function makeHandlers() {
  return {
    onReplyDelta: vi.fn<(text: string) => void>(),
    onSheetDelta: vi.fn<(text: string) => void>(),
    onSheetEdit: vi.fn<(full: string) => void>(),
  } satisfies ParserHandlers;
}

describe("TagParser", () => {
  it("emits onReplyDelta and onDone for a reply-only response", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("<reply>Hello world.</reply>");
    p.end();
    expect(h.onReplyDelta).toHaveBeenCalledWith("Hello world.");
    expect(h.onSheetEdit).not.toHaveBeenCalled();
    expect(p.error).toBeNull();
  });

  it("emits both onReplyDelta and onSheetEdit for a reply+sheet response", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("<reply>Shortened it.</reply><sheet># New sheet</sheet>");
    p.end();
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Shortened it.");
    expect(h.onSheetEdit).toHaveBeenCalledWith("# New sheet");
    expect(p.error).toBeNull();
  });

  it("treats an untagged response as a reply", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("Just plain text from a misbehaving model.");
    p.end();
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Just plain text from a misbehaving model.");
    expect(h.onSheetEdit).not.toHaveBeenCalled();
  });

  it("handles chunk boundaries mid-tag", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("<re");
    p.write("ply>Hel");
    p.write("lo</rep");
    p.write("ly><she");
    p.write("et># Sheet</sh");
    p.write("eet>");
    p.end();
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Hello");
    expect(h.onSheetEdit).toHaveBeenCalledWith("# Sheet");
    expect(p.error).toBeNull();
  });

  it("discards a never-closed <sheet> and surfaces an error", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("<reply>Edited.</reply><sheet># partial sheet that never closes");
    p.end();
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Edited.");
    expect(h.onSheetEdit).not.toHaveBeenCalled();
    expect(p.error).toMatch(/sheet.*unclosed/i);
  });

  it("discards a never-closed <reply> too (and reports it)", () => {
    const h = makeHandlers();
    const p = new TagParser(h);
    p.write("<reply>Started but never closed");
    p.end();
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Started but never closed");
    expect(p.error).toMatch(/reply.*unclosed/i);
  });
});

describe("capHistory", () => {
  function msg(role: ChatMessage["role"], content: string): ChatMessage {
    return { role, content, ts: "2026-01-01T00:00:00.000Z" };
  }

  it("returns history unchanged when <= 10 messages", () => {
    const h = [msg("user", "a"), msg("assistant", "b")];
    expect(capHistory(h)).toEqual(h);
  });

  it("keeps only the last 10 messages when over the cap", () => {
    const h: ChatMessage[] = [];
    for (let i = 0; i < 25; i++) h.push(msg(i % 2 === 0 ? "user" : "assistant", `m${i}`));
    const capped = capHistory(h);
    expect(capped).toHaveLength(10);
    expect(capped[0].content).toBe("m15");
    expect(capped[9].content).toBe("m24");
  });
});

describe("looksLikeSheet", () => {
  it("returns true when the text starts with a ## heading", () => {
    expect(looksLikeSheet("## Photosynthesis\n- ATP & NADPH")).toBe(true);
  });

  it("returns true when a ## heading appears on its own line later in the text", () => {
    expect(looksLikeSheet("Some intro paragraph.\n\n## Section\n- bullet")).toBe(true);
  });

  it("returns true when there are 2+ ### subheads", () => {
    expect(looksLikeSheet("### Photosynthesis\nfoo\n### Respiration\nbar")).toBe(true);
  });

  it("returns false for normal Q&A prose with no headings", () => {
    expect(looksLikeSheet("NADPH is a reducing agent produced in the light reactions of photosynthesis.")).toBe(false);
  });

  it("returns false for prose that mentions ## mid-sentence", () => {
    expect(looksLikeSheet("In markdown you use ## for headings and ### for subheads.")).toBe(false);
  });

  it("returns false for a single ### subhead (1 is not enough)", () => {
    expect(looksLikeSheet("### Just one\nfoo")).toBe(false);
  });

  it("returns false for the empty string", () => {
    expect(looksLikeSheet("")).toBe(false);
  });
});
