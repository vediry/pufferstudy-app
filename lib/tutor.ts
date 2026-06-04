// Pure parser for the Tutor's JSON reply. Never throws; falls back to treating
// the raw string as plain text (no chips) so a malformed reply still shows.
export type TutorReply = { text: string; suggestions: string[] };

function stripFences(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : s;
}

export function parseTutorResponse(raw: string): TutorReply {
  if (typeof raw !== "string" || !raw.trim()) {
    return { text: "", suggestions: [] };
  }
  try {
    const data = JSON.parse(stripFences(raw)) as unknown;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      const suggestions = Array.isArray(obj.suggestions)
        ? obj.suggestions
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim())
            .slice(0, 3)
        : [];
      if (text) return { text, suggestions };
    }
  } catch {
    // fall through to plain-text fallback
  }
  return { text: raw.trim(), suggestions: [] };
}
