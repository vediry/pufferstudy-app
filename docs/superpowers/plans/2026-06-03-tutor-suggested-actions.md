# Tutor Suggested Actions + Opt-in Diagrams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Tutor diagrams opt-in and add 2–3 AI-suggested, contextual action chips under each reply.

**Architecture:** Tutor API returns `{ text, suggestions[] }` (Gemini JSON mode); a pure `parseTutorResponse()` extracts it with a graceful fallback; the page stores suggestions on each assistant turn and renders clickable chips under the latest reply. Tutor-only; Diagrams tab untouched.

**Tech Stack:** Next.js 15, React 19, Gemini 2.5 Flash, Vitest 2 (node), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-03-tutor-suggested-actions-design.md`

---

### Task 1: `parseTutorResponse` (TDD) — `lib/tutor.ts` (+ test)

- [ ] **Step 1: Failing tests** — create `lib/tutor.test.ts`:

```ts
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
```

- [ ] **Step 2: Run → fail** — `npx vitest run lib/tutor.test.ts` (module not found).

- [ ] **Step 3: Implement** — create `lib/tutor.ts`:

```ts
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
```

- [ ] **Step 4: Run → pass** — `npx vitest run lib/tutor.test.ts` (7 pass).
- [ ] **Step 5: Commit** — `feat(tutor): pure parseTutorResponse helper with tests`.

---

### Task 2: Opt-in diagrams + JSON response — `app/api/tutor/route.ts`

Rewrite the file: new `TUTOR_SYSTEM` (diagrams opt-in, JSON output with
`suggestions`, drop the spoken end-of-reply check-in), import
`parseTutorResponse`, add `responseMimeType: "application/json"`, bump
`maxOutputTokens` to 1536, and return `{ text, suggestions }`. Full new file
content is applied in implementation; behavior per spec §1–2. Keep the API-key/
empty-message guards and the error handling exactly as they are.

- [ ] **Step 1:** Replace `TUTOR_SYSTEM` with the opt-in + JSON version (see spec §1).
- [ ] **Step 2:** `import { parseTutorResponse } from "@/lib/tutor";`
- [ ] **Step 3:** `generationConfig: { temperature: 0.7, maxOutputTokens: 1536, responseMimeType: "application/json" }`.
- [ ] **Step 4:** After extracting `text`, `const reply = parseTutorResponse(text ?? "");` → if `!reply.text` keep the existing 502; else `return NextResponse.json({ text: reply.text, suggestions: reply.suggestions });`
- [ ] **Step 5:** `npx tsc --noEmit` → clean. Commit `feat(tutor): opt-in diagrams + JSON reply with suggestions`.

---

### Task 3: Chip UI — `app/tutor/page.tsx`

- [ ] **Step 1:** `type Turn = { role: "user" | "assistant"; text: string; suggestions?: string[] };`
- [ ] **Step 2:** In `send()`, type the response as `{ text?: string; suggestions?: string[]; error?: string }` and store `{ role: "assistant", text: data.text!, suggestions: data.suggestions ?? [] }`.
- [ ] **Step 3:** After the `{messages.map(...)}` block (before the `sending` indicator), add a chip row shown only when idle and the last message is an assistant turn with suggestions:

```tsx
        {(() => {
          const last = messages[messages.length - 1];
          if (
            status.kind === "idle" &&
            last?.role === "assistant" &&
            last.suggestions &&
            last.suggestions.length > 0
          ) {
            return (
              <div className="flex flex-wrap gap-2 pl-8">
                {last.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!hasKey || sending}
                    onClick={() => void send(s)}
                    className="animate-fade-up rounded-full border border-default bg-surface-2 px-3 py-1 text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          }
          return null;
        })()}
```

- [ ] **Step 4:** `npx tsc --noEmit` → clean. Commit `feat(tutor): suggested-action chips under the latest reply`.

---

### Task 4: Verify + ship v3.9.0

- [ ] **Step 1:** `npx tsc --noEmit` clean · `npx vitest run` (111 = 104 + 7) · `npx next build` (stop dev server first).
- [ ] **Step 2:** Live smoke: normal question → no auto-diagram + relevant chips; click a diagram chip → themed Mermaid renders; click "Quiz me" → quizzes; chips only under latest reply.
- [ ] **Step 3:** Bump `package.json` 3.8.0 → 3.9.0; commit; `git tag -a v3.9.0 -m "Tutor suggested actions + opt-in diagrams"`.
- [ ] **Step 4:** `git checkout main && git merge --ff-only feat/tutor-suggested-actions && git push origin main --follow-tags`.
- [ ] **Step 5:** `[SHIPPED]` ping (fire once; ignore failure — user watches the terminal).

---

## Self-Review

- Opt-in diagrams (prompt) → Task 2 ✓ · JSON response + token bump → Task 2 ✓
- `parseTutorResponse` pure + tested → Task 1 ✓ · used in route → Task 2 ✓
- `Turn.suggestions` + chip row under latest reply → Task 3 ✓
- Graceful fallback (malformed → text, no chips) → Task 1 ✓
- Testing + ship → Tasks 1, 4 ✓
- Types consistent: `parseTutorResponse(raw: string): {text, suggestions}` defined Task 1, used Task 2; `Turn.suggestions?: string[]` Task 3 matches API `{text, suggestions}`. ✓
- No placeholders (route full content applied at implementation per spec §1, which contains the complete prompt). ✓
