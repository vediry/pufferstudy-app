# PufferStudy v2.2 — Cheatsheet chat UX cleanup

## Problem

In v2.1, when the model handles an Edit turn but fails to follow the `<reply>` / `<sheet>` tag protocol, the rewritten sheet renders as a giant assistant bubble inside the chat instead of being applied to the cheat sheet panel. The chat sits directly below the sheet with the same surface color and markdown rendering, so a misformatted edit visually consumes the page.

Two distinct failure modes:

1. Model emits no tags at all. The tag parser charitably routes the whole stream to the reply channel — full rewritten sheet appears in chat.
2. Model writes the rewrite inside `<reply>` (e.g. `<reply>## Photosynthesis\n...</reply>` with no `<sheet>` block). The parser correctly routes it as reply text. Sheet never updates; chat bubble is huge.

The fix is **defense in depth** across three layers: tighten the prompt to reduce the failure rate, recover at the parser level when it happens anyway, and restructure the layout so any reply that still slips through is visually contained.

## Goals

- A misformatted edit response cannot visually take over the cheatsheet page.
- A misformatted edit response that contains a complete sheet rewrite still updates the sheet panel, transparently to the user.
- The two-column layout puts the chat next to the sheet on desktop, so refinement feels conversational rather than appended.
- No regressions to v2.1 happy paths (clean Q&A, clean Edit, suggested prompt chips, persistence).

## Non-goals

- Undo for parser false positives (deferred — rare, recoverable by Regenerate).
- Streaming sheet edits directly into the `<CheatsheetView>` as they arrive (current behavior: sheet swaps in after the stream ends — preserved).
- Server-side validation/retry of the model response. Recovery is purely client-side.
- New API routes, new env vars, new DB columns.

## Architecture

Three coordinated changes in existing surfaces:

| Layer | File | Change |
| --- | --- | --- |
| Prompt | `lib/prompts.ts` | Rewrite `REFINE_SYSTEM` with positive + negative tag examples |
| Parser | `lib/refine-stream.ts` | Add `looksLikeSheet()`; in `refine()` post-stream, re-route sheet-shaped replies to a synthetic sheet edit |
| Page shell | `app/subjects/[id]/cheatsheet/page.tsx` | Widen container to `max-w-[1280px]`, switch to 60/40 two-column at `≥lg`, sticky chat column |
| Chat component | `components/cheatsheet-chat.tsx` | Cap rendered bubble height with "Show more", drop the centered `max-w-[760px]` constraint in two-column mode |
| Tests | `lib/refine-stream.test.ts` | Add cases for `looksLikeSheet` and auto-detect paths |

No DB changes. No new API routes. The `chat_messages` JSONB column from v2.1 is unchanged.

## Layout — two-column

### Desktop (`≥1024px`)

- Container for the cheatsheet route widens from `max-w-[1120px]` to `max-w-[1280px]`. Other routes keep 1120.
- Wrap `<CheatsheetView>` and `<CheatsheetChat>` in a flex row with `gap-6`. Sheet column gets `flex-[3]`, chat column gets `flex-[2]` — a 60/40 split.
- Chat column is `sticky top-6 self-start max-h-[calc(100vh-6rem)]` so the input stays in viewport when the user scrolls a long sheet. CSS-only, no scroll JS.
- Header (back link, regenerate, print buttons) stays above the row, full width.
- Inside the chat column, drop the existing `max-w-[760px]` centered constraint — the chat fills its column.

### Mobile (`<1024px`)

- Single column, sheet then chat below. Same DOM order as today.
- The chat section gets visual separation matching what we sketched as Option A: a dashed top divider, a slightly darker panel background, and a section header "Chat about this sheet".
- The `max-w-[760px]` centered constraint is preserved on mobile so the chat doesn't stretch on tablets.

### Print

- Chat section hidden via the existing `no-print` class. Print output is sheet only, full width. No change.

## Bubble height cap

Applies to every assistant bubble in the message list and to the live streaming bubble. User bubbles are uncapped (always short).

### Resolved bubbles

- Render with `max-h-[14rem]` (~6–8 lines of prose), `overflow-hidden`, and a fade-out gradient on the bottom 2rem.
- After render, compare `scrollHeight > clientHeight` via `useRef` on the bubble content node. If it overflows, show a "Show more" link at the bottom.
- Clicking "Show more" toggles the cap off (sets state on that bubble), expanding inline. No modal, no scroll, no navigation.

### Streaming bubble

- Same `max-h-[14rem]` cap applied to `status.pendingAssistant`. No "Show more" link while streaming — the bubble auto-scrolls to bottom internally so the tail of the incoming text stays visible.
- Once `onDone` fires and the message is pushed into the resolved list, the bubble renders with the "Show more" affordance if it overflows.

### Safety contract

Even if the prompt rewrite is ignored and the parser auto-detect misses, this cap guarantees a misformatted reply cannot visually consume the page. It is the last line of defense.

## Parser auto-detect

New helper in `lib/refine-stream.ts`:

```ts
function looksLikeSheet(text: string): boolean {
  const hasH2 = /(^|\n)##\s+\S/.test(text);
  const subheadCount = (text.match(/(^|\n)###\s+\S/g) || []).length;
  return hasH2 || subheadCount >= 2;
}
```

A `## ` heading at the start of a line is the strongest signal — a Q&A reply almost never uses H2 sections. Two or more `### ` subheads also qualify.

### Where it fires

In `refine()`, after `parser.end()`, before `handlers.onDone({...})`. Three cases:

1. **Both `<reply>` and `<sheet>` parsed cleanly.** No-op. Use as-is.
2. **Only `<reply>` parsed AND `looksLikeSheet(replyText)` is true.** Treat as a misformatted edit:
   - Call `handlers.onSheetEdit(replyText)` to apply the recovered sheet.
   - Replace `replyText` with `"Updated the sheet ✓"` before firing `onDone`.
   - Fire `onDone({ sheetEdited: true, replyText: "Updated the sheet ✓", parserError: null })`.
3. **Parser surfaced an error (e.g. unclosed `<sheet>`) AND `looksLikeSheet` is true on the accumulated buffer.** Same recovery as case 2, but clear the parser error so the UI doesn't show an error toast.

### Accepted trade-off

If a student legitimately asks the model to "generate a markdown-formatted study guide for this topic", the auto-detect would wrongly route the reply to the sheet. Accepted because:

- Rare in practice — the chat is positioned for refinement and Q&A, not generation.
- The previous sheet is preserved on the server until the PATCH completes — Regenerate recovers it.
- v2.2 ships without an Undo affordance to keep scope tight. If false positives prove common in usage, add Undo in v2.3.

## Prompt rewrite

Full replacement for `REFINE_SYSTEM` in `lib/prompts.ts`:

```
You are PufferStudy, helping a student refine a one-page cheat sheet they
already generated, and answering quick questions about the subject.

You will receive:
- The current sheet inside <currentSheet>…</currentSheet>
- Prior conversation turns
- The student's new message

You MUST respond using exactly one of these two shapes. No other format is allowed.

──────────────────────────────────────────
Shape 1 — Q&A turn (the student asked a question, not a request to change the sheet)

<reply>Your answer here in markdown. 1–3 short paragraphs.</reply>

Example:
Student: "What's the role of NADPH?"
You: <reply>NADPH is a reducing agent produced in the light reactions of
photosynthesis. The Calvin cycle then uses it to fix CO₂ into sugar.</reply>

──────────────────────────────────────────
Shape 2 — Edit turn (the student asked you to change, shorten, add to, or
restructure the sheet)

<reply>One short sentence confirming what you changed.</reply><sheet>THE COMPLETE
rewritten cheat sheet in markdown — every section that should remain, not just
the changed part, not a diff.</sheet>

Example:
Student: "Make the Calvin cycle section shorter"
You: <reply>Trimmed Calvin cycle to two lines.</reply><sheet>## Photosynthesis
- Light reactions in thylakoid — produce ATP & NADPH
- Calvin cycle in stroma — fixes CO₂ to glucose
…rest of sheet here…</sheet>

──────────────────────────────────────────
DO NOT:
- Put the rewritten sheet inside <reply>. The full rewrite ONLY goes inside <sheet>.
- Emit text outside the tags. No preamble, no apology, no "here is your sheet".
- Wrap the tags in code fences.
- Use <sheet> for Q&A turns.
- Output a diff or partial sheet. <sheet> is always the COMPLETE sheet.

Decide between Shape 1 and Shape 2 from the student's message. "Make it shorter",
"add more on X", "remove Y", "restructure", "expand the Z section" → Shape 2.
"What is X", "explain Y", "why does Z" → Shape 1.

Keep the same style as the original sheet: ## sections, ### sub-topics, bullets,
**bold key terms**, formulas/dates preserved. The sheet should still fit roughly
one printed page. Do not apologize, do not praise.
```

## Testing

### Unit tests — extend `lib/refine-stream.test.ts`

- `looksLikeSheet`:
  - Positive for text starting with `## Heading`.
  - Positive for text containing two or more `### Subhead` lines.
  - Negative for normal Q&A prose (no headings).
  - Negative for prose that mentions `##` mid-sentence (e.g. "use ## for headings").
- `refine()` clean Q&A path: stream `<reply>foo</reply>` → `onDone` reports `sheetEdited: false`, `replyText: "foo"`, no `onSheetEdit` call.
- `refine()` clean Edit path: stream `<reply>done</reply><sheet>## X</sheet>` → behavior unchanged from v2.1.
- `refine()` auto-detect path: stream with no `<sheet>` tag but a sheet-shaped reply → `onSheetEdit` fired with the reply content, `onDone` reports `sheetEdited: true` and `replyText: "Updated the sheet ✓"`.
- `refine()` partial-sheet recovery: stream ends mid-`<sheet>` (parser would surface an error) but accumulated buffer is sheet-shaped → recovery fires, no error reaches `onDone.parserError`.

### Manual E2E in browser before merge

1. Send "make Calvin cycle shorter" → short reply bubble + sheet updates above. (Happy path.)
2. Force the failure mode by temporarily replacing `REFINE_SYSTEM` with a version that puts the rewrite inside `<reply>` → verify auto-detect catches it, sheet still updates, bubble shows "Updated the sheet ✓". Revert prompt before merging.
3. Q&A turn: "what is mitosis" → inline reply, sheet untouched.
4. Long legitimate Q&A: "explain everything you know about photosynthesis in detail" → bubble caps with "Show more" link, expands on click.
5. Print preview (Ctrl+P) → chat hidden, sheet full width.
6. Resize to <1024px → chat stacks below sheet with dashed divider and panel background.
7. Existing v2.1 features still work: suggested prompt chips, send-while-streaming disabled, abort on unmount.

## Open questions

None blocking. Threshold values (`max-h-[14rem]`, the `looksLikeSheet` regex) are tunable post-launch if real usage shows them off.

## Out of scope for v2.2

- Undo for auto-detect false positives (deferred to v2.3 if needed).
- Streaming sheet edits directly into `<CheatsheetView>` as they arrive.
- Server-side validation/retry of the model response.
- Custom domain unification ([[pufferstudy-domain-unification-plan]]).
