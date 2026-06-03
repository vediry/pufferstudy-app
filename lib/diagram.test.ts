import { describe, it, expect } from "vitest";
import {
  buildDiagramPrompt,
  parseDiagramResponse,
  DIAGRAM_TYPES,
  sanitizeMermaid,
} from "@/lib/diagram";

describe("buildDiagramPrompt", () => {
  it("uses the typed topic when present", () => {
    const p = buildDiagramPrompt({ topic: "causes of WWI" });
    expect(p).toContain("causes of WWI");
  });

  it("falls back to a subject overview when no topic is given", () => {
    const p = buildDiagramPrompt({ subjectName: "Biology" });
    expect(p.toLowerCase()).toContain("overview");
    expect(p).toContain("Biology");
  });

  it("includes the subject materials block when materials are present", () => {
    const p = buildDiagramPrompt({
      subjectName: "Biology",
      materials: "Cells are the unit of life.",
    });
    expect(p).toContain("<materials>");
    expect(p).toContain("Cells are the unit of life.");
  });

  it("omits the materials block when materials are empty", () => {
    const p = buildDiagramPrompt({ subjectName: "Biology", materials: "   " });
    expect(p).not.toContain("<materials>");
  });

  it("injects a forceType instruction only when forceType is set", () => {
    expect(buildDiagramPrompt({ topic: "x" })).not.toMatch(/Use a .* diagram/);
    const p = buildDiagramPrompt({ topic: "x", forceType: "timeline" });
    expect(p).toContain("Use a timeline diagram");
  });

  it("returns an empty string when there is nothing to map", () => {
    expect(buildDiagramPrompt({})).toBe("");
  });
});

describe("parseDiagramResponse", () => {
  const good = JSON.stringify({
    type: "flowchart",
    title: "Photosynthesis",
    mermaid: "flowchart TD\n  A --> B",
    key: [{ label: "A", text: "start" }],
  });

  it("parses a well-formed JSON reply", () => {
    const out = parseDiagramResponse(good);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.type).toBe("flowchart");
      expect(out.result.title).toBe("Photosynthesis");
      expect(out.result.mermaid).toContain("flowchart TD");
      expect(out.result.key).toHaveLength(1);
    }
  });

  it("tolerates ```json fences and surrounding whitespace", () => {
    const out = parseDiagramResponse("\n```json\n" + good + "\n```\n");
    expect(out.ok).toBe(true);
  });

  it("repairs a missing/invalid type to a safe default", () => {
    const out = parseDiagramResponse(
      JSON.stringify({ mermaid: "mindmap\n  root((X))", type: "bogus" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(DIAGRAM_TYPES).toContain(out.result.type);
  });

  it("coerces a missing key to an empty array", () => {
    const out = parseDiagramResponse(
      JSON.stringify({ type: "mindmap", mermaid: "mindmap\n  root((X))" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.key).toEqual([]);
  });

  it("returns a typed error (not a throw) on unparseable input", () => {
    const out = parseDiagramResponse("not json at all");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(typeof out.error).toBe("string");
  });

  it("errors when there is no mermaid body", () => {
    const out = parseDiagramResponse(JSON.stringify({ type: "mindmap" }));
    expect(out.ok).toBe(false);
  });
});

describe("sanitizeMermaid", () => {
  it("strips a ```mermaid fence wrapper", () => {
    expect(sanitizeMermaid("```mermaid\nflowchart TD\nA-->B\n```")).toBe(
      "flowchart TD\nA-->B",
    );
  });

  it("strips a plain ``` fence wrapper", () => {
    expect(sanitizeMermaid("```\nmindmap\nroot\n```")).toBe("mindmap\nroot");
  });

  it("normalizes <br>, <BR> and <br /> to <br/>", () => {
    expect(sanitizeMermaid('A["x<br>y<BR>z<br />w"]')).toBe('A["x<br/>y<br/>z<br/>w"]');
  });

  it("straightens smart quotes", () => {
    expect(sanitizeMermaid("A[“hi” ‘there’]")).toBe("A[\"hi\" 'there']");
  });

  it("converts CRLF to LF", () => {
    expect(sanitizeMermaid("flowchart TD\r\nA-->B")).toBe("flowchart TD\nA-->B");
  });

  it("passes clean code through unchanged", () => {
    expect(sanitizeMermaid("flowchart TD\nA-->B")).toBe("flowchart TD\nA-->B");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(sanitizeMermaid(null)).toBe("");
  });
});
