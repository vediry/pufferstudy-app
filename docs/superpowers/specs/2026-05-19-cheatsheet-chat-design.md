# Cheatsheet chat — design

**Date:** 2026-05-19
**Status:** Approved (brainstorm + UX decisions), ready for implementation plan
**Scope:** App repo (`vediry/pufferstudy-app`). No landing changes.

## Goal

Anchor a ChatGPT-style chatbox below the generated cheat sheet on `/subjects/[id]/cheatsheet`. One chat blends two behaviors:

- **Refine the sheet** — "make X shorter", "add more on Y", "remove the second example" → the cheat sheet rewrites in place.
- **Ask about the subject** — "explain how mitochondria make ATP" → a markdown answer streams into the chat; the sheet is untouched.

Intent is auto-detected from the user's message — no toggle, no slash command.

## What's already decided

Locked via brainstorming + AskUserQuestion on 2026-05-19. Don't relitigate without flagging it:

1. **Layout** — chatbox lives inline as the next section below `<CheatsheetView>` on the cheatsheet page. Not a popup, not a sidebar. Always visible. ChatGPT-style.
2. **Edit behavior** — the assistant rewrites the cheat sheet in place (canvas / artifact pattern). The chat reply for an edit is a one-line confirmation, not the full rewritten content.
3. **Intent detection** — model decides per-message whether it's an edit or a Q&A. No UI affordance for the user to override.
4. **Persistence** — cloud-sync per subject via Neon Postgres. Both the chat transcript AND the edited sheet survive device switches. Same scoping as everything else (Clerk `userId`).
5. **Context per turn** — the model receives the current cheat sheet markdown + chat history only. **Original uploaded PDFs/images are NOT re-sent each turn.** This is an explicit trade-off: lower cost and latency, at the price of the assistant only being able to reason about what's already distilled into the sheet. Accepted by user.

## Tag protocol

The trickiest part. The model emits a tagged stream that the client splits into two channels — chat reply text and (optional) full sheet rewrite.

**Q&A turn:**

```
<reply>Markdown answer here, possibly multiple paragraphs.</reply>
```

**Edit turn:**

```
<reply>One-line summary of what I changed.</reply><sheet>COMPLETE rewritten cheat sheet markdown — not a patch, not a diff.</sheet>
```

Rules:

- `<sheet>` always contains the **entire new sheet**, never a diff. Simpler client logic, no patch reconciliation, and Gemini handles full rewrites well at our sheet sizes.
- If the model omits tags entirely, the whole response is treated as `<reply>`.
- If `<sheet>` opens but never closes (stream cut, model bug), the partial sheet is **discarded** and an error toast surfaces. The pre-edit sheet stays as-is.
- Order is fixed: `<reply>` always comes before `<sheet>` when both are present.

### Client parser

A state machine in `lib/gemini-client.ts` exposing three callbacks:

- `onReplyDelta(text: string)` — fires as `<reply>` content streams in
- `onSheetDelta(text: string)` — fires as `<sheet>` content streams in (optional — UI may choose to wait for full sheet)
- `onSheetEdit(full: string)` — fires once when `</sheet>` is seen, with the complete new sheet

Must handle chunk boundaries mid-tag — buffer until enough characters to disambiguate `<r…` vs `<s…` vs literal text.

## Backend — `/api/generate`

Extend the existing route with a new `mode: "refine"`. Existing `mode: "generate"` (initial sheet creation from PDFs/images) is unchanged.

Refine-mode request body:

```ts
{
  mode: "refine",
  apiKey: string,            // user's Gemini key, same as today
  subjectId: string,
  currentSheet: string,      // full markdown of the current sheet
  history: Array<{ role: "user" | "assistant", content: string }>, // capped client-side to last 10 turns
  message: string,           // the new user message
}
```

Server behavior:

- Skip the `getFilesByIds` + `blobUrlToBase64` block. **No file fetch in refine mode** — that's the whole point of the context-per-turn trade-off.
- Build the Gemini prompt as: `[system prompt] + [currentSheet block] + [history turns] + [new user message]`.
- Stream Gemini's response straight back to the client.
- New system prompt (drafted during brainstorm — finalize during implementation) describes the tag protocol with examples of both turn types.

Generate-mode (existing) untouched. Same route, branched on `mode`.

## DB schema

One migration, one column:

```sql
ALTER TABLE subjects ADD COLUMN chat_messages JSONB NOT NULL DEFAULT '[]';
```

**Use `sql.query("ALTER ...")`, NOT the tagged template `` sql`ALTER ...` ``.** The tagged template silently swallows DDL with `@vercel/postgres` (documented gotcha — bit us during cloud sync work).

Chat message shape stored in the JSONB array:

```ts
{
  role: "user" | "assistant",
  content: string,
  ts: string,             // ISO8601
  sheetEdited?: boolean,  // true if this assistant turn also rewrote the sheet
}
```

No separate `chat_messages` table — single subject = single chat, no pagination concerns at the sizes we expect (< 100 messages per subject realistically).

## API

**Extend** the existing `PATCH /api/subjects/[id]` to accept `chatMessages` alongside the existing `cheatsheetMarkdown`. One PATCH per assistant turn writes both atomically (so a refine turn updates the sheet and appends the two new messages in one round-trip).

```ts
// PATCH /api/subjects/[id] body
{
  name?: string,
  testLabel?: string,
  testDate?: string,
  cheatsheetMarkdown?: string,
  chatMessages?: ChatMessage[],
}
```

**No new endpoints.** Streaming the Gemini response continues to go through `/api/generate`; persistence goes through the existing subjects PATCH after the stream completes.

## UI

New component: `components/cheatsheet-chat.tsx`, mounted below `<CheatsheetView>` on `app/subjects/[id]/cheatsheet/page.tsx`.

Layout:

- Message list — sticky-to-bottom on new messages, scrollable. Faint moss-tinted background for assistant bubbles (`#6BBF8A` at low alpha), plain bordered bubbles for user.
- Input — large multi-line textarea with an arrow-up send button, 24px rounded corners (matching the chat input mockup the user approved).
- Suggested-prompt chips above the input on empty chat: "Make it shorter", "Add more examples", "Quiz me on this". Clicking a chip fills the textarea, doesn't auto-send.
- Below the input, muted hint text: "Powered by your Gemini key".

States:

- **Empty sheet** — input disabled, placeholder reads "Generate the cheat sheet first to start chatting".
- **Streaming** — send button disabled (no queuing of multiple turns). Streaming reply renders into the latest assistant bubble; if it's an edit turn, the sheet above replaces atomically on `onSheetEdit` (no live char-by-char rewrite of the canvas — see Out of scope).
- **Error** — toast for stream failures, mid-tag truncation, or 4xx/5xx from `/api/generate`. Chat state stays consistent: nothing partial is persisted.

## Persistence flow per turn

1. User submits message → optimistically append `{role: "user", content, ts}` to local chat state.
2. POST `/api/generate` with `mode: "refine"`, current sheet, capped history, new message. Stream begins.
3. Parser routes deltas to `onReplyDelta` (always) and `onSheetDelta`/`onSheetEdit` (edit turns only). UI updates live.
4. On `onDone`:
   - Append `{role: "assistant", content: <reply>, ts, sheetEdited: <bool>}` to local state.
   - If edit turn: also update local `cheatsheetMarkdown` to the new `<sheet>` content.
   - PATCH `/api/subjects/[id]` with `{chatMessages, cheatsheetMarkdown?}`. Single write.
5. On stream error or mid-tag truncation: drop the partial assistant message, do NOT PATCH. Local state reverts to pre-turn. Sheet stays at pre-edit version. Toast.

## Edge cases

- **Nav away mid-stream** — partial response lost. No persistence happens until `onDone`, so the DB is consistent with the previous turn. On return, the user just doesn't see the half-formed reply.
- **Refresh mid-stream** — same as nav away.
- **Empty cheat sheet** — input disabled, can't trigger turn. Prevents undefined `currentSheet` server-side.
- **Cheat sheet regenerated from scratch** — chat history is preserved. Future enhancement could prompt to clear, but for now history carries across regenerations.
- **Cost** — 1 Gemini call per turn against the user's own key, identical billing pattern to today's sheet generation.

## Tests

Minimum bar before merge:

- **Unit tests for the tag parser** (`lib/gemini-client.test.ts` or similar):
  - `<reply>foo</reply>` only — emits onReplyDelta + onDone
  - `<reply>foo</reply><sheet>bar</sheet>` — emits both, onSheetEdit fires with `"bar"`
  - Malformed: `<reply>foo` (never closes) — emits onReplyDelta partial, onDone with no sheet
  - Malformed: `<reply>foo</reply><sheet>bar` (sheet never closes) — emits onReplyDelta, **does NOT** fire onSheetEdit, surfaces an error
  - Mid-tag chunk boundaries — split `<re` + `ply>foo</reply>` across two chunks, still parses correctly
- **Unit test for history pruning** — given 25 messages, only last 10 are sent to `/api/generate`.
- **Manual E2E in browser** — generate a sheet, ask a Q&A question, then ask for a refinement, verify sheet updates in place, refresh page, verify chat + sheet persist, sign in on second device, verify same state.

No integration tests against real Gemini — too flaky/slow for CI, and the parser tests cover the contract.

## Dependencies

No new packages. Reuses:

- `@vercel/postgres` — existing, for the column add + read/write
- Existing Gemini streaming code in `app/api/generate/route.ts`
- Existing Clerk auth middleware

## Implementation sequence (rough, to be refined by writing-plans skill)

1. DB migration — add `chat_messages` column via `sql.query()`.
2. Tag parser + tests in `lib/gemini-client.ts` (or new `lib/cheatsheet-chat-stream.ts`).
3. `/api/generate` refactor — add `mode: "refine"` branch, new system prompt.
4. Extend `PATCH /api/subjects/[id]` to accept `chatMessages`.
5. `<CheatsheetChat>` component + integration into cheatsheet page.
6. Manual E2E + ship.

These are largely independent (parser ↔ API ↔ UI), so subagent-driven development is a good fit per the existing parallelism guidance.

## Out of scope

- Re-uploading original PDFs/images per turn — deliberately excluded (see decision #5). Could revisit if users hit the wall of "the sheet doesn't have enough context for my question".
- Multi-chat per subject — single chat per subject only.
- Image generation in replies — text and markdown only.
- Voice input for chat — voice notes feature exists for adding to subjects, not for chatting.
- Streaming the sheet rewrite character-by-character into the canvas — start with "replace on `onSheetEdit`". Live-streaming the canvas is a polish item, not a blocker.
- Citations / source highlighting (e.g. "this came from page 3 of your notes").
- Export chat as markdown.
- Search across chat history.

## Risks

- **Tag parser bugs** — the parser is the linchpin. Unit tests + the malformed-tag fallbacks (treat untagged as `<reply>`, discard half-open `<sheet>`) are the mitigation.
- **Model ignoring the tag protocol** — Gemini occasionally drops format instructions. Untagged-as-reply fallback means the worst case for Q&A is "it still works"; for edits it means "the user sees a textual description of the change instead of the sheet updating". Acceptable degradation.
- **JSONB growth on `subjects`** — at hundreds of messages per subject, the row gets large and every PATCH rewrites the whole array. If this becomes an issue, split to a `chat_messages` table later. Cheap migration when needed.
- **History cap at 10 turns** — long conversations lose early context. Document this; revisit if users complain.
- **Gemini context window** — current sheet + last 10 turns + new message is sent every refine call. A dense, multi-page sheet plus long history could approach the model's input limit. Watch for `400` errors from Gemini citing token limits; mitigations if it bites: trim history harder (e.g. last 6 turns), summarize older turns, or warn the user when the sheet exceeds a size threshold. Not pre-engineering this.
- **No rate limiting** — the user's own Gemini key handles their own quota. Not our concern.

## Open questions

None blocking. Decision points called out inline ("decision deferrable" for live-streaming sheet rewrite).
