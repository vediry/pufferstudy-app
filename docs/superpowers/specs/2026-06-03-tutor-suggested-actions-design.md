# Tutor: Opt-in Diagrams + Suggested-Action Chips (Sub-project C)

**Date:** 2026-06-03
**Status:** Design — approved in brainstorm, pending implementation
**Version target:** minor bump (new tutor behavior, no data/schema change)

## Goal

Two linked changes to the Tutor:
1. **Opt-in diagrams** — today `TUTOR_SYSTEM` auto-adds a Mermaid diagram to most
   structured replies. Flip it: the tutor draws a diagram **only when the student
   asks** (incl. clicking a diagram chip). Replies become text-first/calm.
2. **AI-suggested action chips** — after each tutor reply, show 2–3 clickable,
   **contextual** next-step chips tailored to that reply (e.g. "Map out the
   causes of WWI", "See a timeline of the war", "Quiz me on this"). Clicking one
   sends it as the student's next message.

**Why:** ~90% of students don't know how to prompt a tutor and give it little to
work with. Specific, ready-to-click suggestions hand them the next step — and one
of them surfaces the visual ("show me a diagram") on demand, instead of the tutor
forcing diagrams on every reply.

Scope is the **Tutor only**. The Diagrams tab is untouched.

## Scope

### In scope
- `TUTOR_SYSTEM` prompt: diagrams opt-in; emit a structured JSON reply with
  `suggestions`.
- Tutor API returns `{ text, suggestions[] }` (was `{ text }`), via Gemini
  `responseMimeType: "application/json"`.
- New pure `parseTutorResponse()` helper (+ unit tests).
- Tutor page: `Turn.suggestions`, chip row under the latest assistant reply.

### Out of scope (YAGNI)
- The anti-cheat "learn don't cheat" guardrail (separate, deferred — see
  [[pufferstudy-tutor-guardrail]]).
- Persisting tutor conversations (stays ephemeral).
- The Diagrams tab, streaming, or model/temperature changes beyond a token bump.

## Design

### 1. `TUTOR_SYSTEM` rewrite — `app/api/tutor/route.ts`

Keep: the warm-tutor persona, adaptive teaching style, "keep it simple / go slow"
guidance, the Mermaid syntax rules + example, and the honesty line.

Change:
- **Output format:** respond with ONLY a JSON object
  `{ "text": "<markdown reply>", "suggestions": ["...", "..."] }` — no prose
  outside the JSON.
- **Diagrams opt-in:** include a ```mermaid fenced block **inside `text`** ONLY
  when the student explicitly asks for a visual (draw / map out / show me /
  diagram / "see how it works"). Otherwise do NOT add a diagram.
- **Suggestions:** 2–3 short next-step messages, each phrased as the *student's*
  next message, specific to THIS reply, naming specifics (≤ ~6 words). When the
  topic is visualizable, make exactly ONE suggestion a diagram/illustration
  request. Examples: "Map out the causes of WWI", "Quiz me on this", "Explain
  recursion more simply".
- **Remove** the old "ALWAYS end your reply by checking in" spoken-offer section
  — the chips now carry the next-step offer, so `text` stays focused on teaching.

### 2. Structured response — `app/api/tutor/route.ts`

- Add `responseMimeType: "application/json"` to `generationConfig`; bump
  `maxOutputTokens` 1024 → 1536 (JSON escaping + an optional mermaid block +
  suggestions; guards against truncated-JSON parse failures).
- Parse the model text with `parseTutorResponse(text)` and return
  `NextResponse.json({ text, suggestions })`. If `text` is empty after parsing,
  keep the existing "didn't have a reply" 502.

### 3. Pure parser — `lib/tutor.ts` (new) + `lib/tutor.test.ts`

```
export type TutorReply = { text: string; suggestions: string[] };
export function parseTutorResponse(raw: string): TutorReply
```
Behavior:
- Empty/non-string → `{ text: "", suggestions: [] }`.
- Strip a ``` / ```json fence, `JSON.parse`. Take `text` (string) and
  `suggestions` (array of non-empty strings, trimmed, capped at 3).
- Malformed JSON or model returned plain prose → fallback
  `{ text: raw.trim(), suggestions: [] }` (so the reply still shows, just no
  chips). Never throws.

### 4. Chips UI — `app/tutor/page.tsx`

- `type Turn = { role: "user" | "assistant"; text: string; suggestions?: string[] }`.
- In `send()`, the success branch reads `{ text, suggestions }` and stores
  `{ role: "assistant", text, suggestions: suggestions ?? [] }`.
- After the message list, render a chip row **only** when: status is idle AND the
  last message is an assistant turn with ≥1 suggestion. Each chip is a button
  (reusing the empty-state chip styling) that calls `send(suggestion)`; disabled
  when no key / sending. Chips show only under the latest reply (no stale chips
  up the history). Empty-state starter chips unchanged.

## Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/tutor.ts` | Pure parse of model JSON → `{text, suggestions}` | none |
| `app/api/tutor/route.ts` | Opt-in-diagram prompt, JSON response, parse | `parseTutorResponse` |
| `app/tutor/page.tsx` | Store + render suggestion chips, send on click | API shape |

No new dependencies. `MermaidDiagram` rendering (now themed from sub-project B)
is unchanged and still renders any ```mermaid block the tutor includes on request.

## Testing

- **Unit (`lib/tutor.test.ts`):** valid JSON; fenced ```json; missing
  `suggestions`; non-array `suggestions`; empty/whitespace suggestion filtering +
  cap at 3; malformed JSON → `{text: raw, suggestions: []}`; empty input. Existing
  104 tests stay green.
- **Live (localhost):** ask the tutor a normal question → no auto-diagram, 2–3
  relevant chips appear; click a diagram chip → a themed Mermaid diagram renders;
  click "Quiz me" → it quizzes; confirm chips only show under the latest reply
  and clear while a reply is generating.
- **Gate:** `tsc` clean · `vitest` green · `next build` succeeds.

## Success criteria

- Tutor no longer forces diagrams; they appear only on request.
- Every substantive reply shows 2–3 specific, clickable next-step chips, one of
  which offers a visual when relevant.
- Clicking a chip sends it as the student's message and continues the lesson.
- Malformed model output degrades to a plain reply (no chips), never a crash.
- No regressions: tsc clean, 104 tests green, build passes, no new deps.

## Follow-ups (separate)

- Anti-cheat guardrail in `TUTOR_SYSTEM` (deferred — [[pufferstudy-tutor-guardrail]]).
