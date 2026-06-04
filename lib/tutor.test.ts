import { describe, it, expect } from "vitest";
import { parseTutorResponse } from "@/lib/tutor";

describe("parseTutorResponse", () => {
  it("parses a valid JSON object", () => {
    const r = parseTutorResponse('{"text":"hi","suggestions":["a","b"]}');
    expect(r).toEqual({ text: "hi", suggestions: ["a", "b"] });
  });
  it("strips a ```json fence", () => {
    const r = parseTutorResponse('```json\n{"text":"hi","suggestions":["a"]}\n```');
    expect(r).toEqual({ text: "hi", suggestions: ["a"] });
  });
  it("defaults suggestions to [] when missing", () => {
    expect(parseTutorResponse('{"text":"hi"}')).toEqual({ text: "hi", suggestions: [] });
  });
  it("ignores a non-array suggestions field", () => {
    expect(parseTutorResponse('{"text":"hi","suggestions":"nope"}')).toEqual({
      text: "hi",
      suggestions: [],
    });
  });
  it("filters empty/non-string suggestions and caps at 3", () => {
    const r = parseTutorResponse(
      '{"text":"hi","suggestions":["a"," b ","",5,"c","d"]}',
    );
    expect(r).toEqual({ text: "hi", suggestions: ["a", "b", "c"] });
  });
  it("falls back to raw text on malformed JSON", () => {
    expect(parseTutorResponse("just words")).toEqual({
      text: "just words",
      suggestions: [],
    });
  });
  it("returns empty for empty input", () => {
    expect(parseTutorResponse("")).toEqual({ text: "", suggestions: [] });
  });
});
