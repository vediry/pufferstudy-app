import { describe, it, expect } from "vitest";
import { renderActivity } from "@/lib/activity-text";
import type { ActivityEvent } from "@/lib/activity";

function ev(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 1,
    subjectId: overrides.subjectId ?? "subj_1",
    subjectName: overrides.subjectName ?? "Biology",
    type: overrides.type!,
    data: overrides.data ?? {},
    createdAt: overrides.createdAt ?? "2026-05-21T09:00:00.000Z",
  };
}

describe("renderActivity", () => {
  it("cheatsheet_generated → 'Generated cheat sheet for {subject}'", () => {
    const out = renderActivity(ev({ type: "cheatsheet_generated" }));
    expect(out.text).toBe("Generated cheat sheet for Biology");
    expect(out.iconKey).toBe("gen");
  });

  it("cheatsheet_refined → 'Refined {topic} in {subject}'", () => {
    const out = renderActivity(ev({ type: "cheatsheet_refined", data: { topic: "Calvin cycle" } }));
    expect(out.text).toBe("Refined Calvin cycle in Biology");
    expect(out.iconKey).toBe("edit");
  });

  it("chat_question → 'Asked about {topic} in {subject}'", () => {
    const out = renderActivity(ev({ type: "chat_question", data: { topic: "NADPH" } }));
    expect(out.text).toBe("Asked about NADPH in Biology");
    expect(out.iconKey).toBe("edit");
  });

  it("files_uploaded with count → pluralizes 'photo' default", () => {
    const out = renderActivity(ev({ type: "files_uploaded", data: { count: 3 } }));
    expect(out.text).toBe("Uploaded 3 photos to Biology");
    expect(out.iconKey).toBe("upload");
  });

  it("files_uploaded with mimeType image/jpeg → 'photo' label", () => {
    const out = renderActivity(ev({ type: "files_uploaded", data: { count: 1, mimeType: "image/jpeg" } }));
    expect(out.text).toBe("Uploaded 1 photo to Biology");
  });

  it("files_uploaded with mimeType application/pdf → 'PDF' label", () => {
    const out = renderActivity(ev({ type: "files_uploaded", data: { count: 1, mimeType: "application/pdf" } }));
    expect(out.text).toBe("Uploaded 1 PDF to Biology");
  });

  it("subject_created → 'Created new subject {name}'", () => {
    const out = renderActivity(ev({ type: "subject_created", subjectName: null, data: { name: "Algebra II" } }));
    expect(out.text).toBe("Created new subject Algebra II");
    expect(out.iconKey).toBe("new");
  });

  it("falls back to subjectName when topic is missing on refined", () => {
    const out = renderActivity(ev({ type: "cheatsheet_refined", data: {} }));
    expect(out.text).toBe("Refined the sheet in Biology");
  });
});
