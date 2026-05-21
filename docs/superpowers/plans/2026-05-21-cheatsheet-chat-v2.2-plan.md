# Cheatsheet Chat v2.2 UX Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defense-in-depth fix so a misformatted edit response from the model cannot consume the cheatsheet page — and when it contains a recoverable sheet rewrite, transparently update the sheet anyway.

**Architecture:** Three coordinated layers — (1) tighten the `REFINE_SYSTEM` prompt with positive + negative tag examples, (2) add a `looksLikeSheet()` heuristic in the parser to re-route sheet-shaped reply text to a synthetic sheet edit, (3) restructure the cheatsheet page into a 60/40 two-column layout on desktop with a hard bubble-height cap so even if both upstream layers fail, no single reply can visually take over.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind v4, vitest (already installed), npm.

**Spec:** `docs/superpowers/specs/2026-05-21-cheatsheet-chat-v2.2-design.md`

---

## File Structure

**Files modified:**

| File | Change |
| --- | --- |
| `lib/refine-stream.ts` | Export `looksLikeSheet`; in `refine()`, apply auto-detect after `parser.end()` to recover sheet-shaped replies |
| `lib/refine-stream.test.ts` | Add cases for `looksLikeSheet` and the auto-detect path in `refine()` |
| `lib/prompts.ts` | Replace `REFINE_SYSTEM` body with positive + negative tag examples |
| `components/cheatsheet-chat.tsx` | Drop `max-w-[760px]` on desktop; add `<MessageBubble>` height cap (`max-h-[14rem]` + "Show more"); apply same cap to streaming bubble |
| `app/subjects/[id]/cheatsheet/page.tsx` | Widen container to `max-w-[1280px]`; wrap sheet + chat in two-column flex at `lg:`, sticky chat column |

**No new files.** No new dependencies. No DB migrations. No new API routes.

---

## Task 1: Add `looksLikeSheet` helper with TDD

**Why first:** Pure-logic helper with no UI dependency — fastest to TDD and underpins the entire auto-detect path in Task 2.

**Files:**
- Modify: `lib/refine-stream.ts`
- Modify: `lib/refine-stream.test.ts`

- [ ] **Step 1.1: Add failing tests for `looksLikeSheet`**

In `lib/refine-stream.test.ts`, add a new `describe` block at the end of the file (after the existing `describe("capHistory", …)` block):

```ts
import { TagParser, capHistory, looksLikeSheet, type ParserHandlers } from "@/lib/refine-stream";

// …existing tests above…

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
```

Also update the `import` at the top of the test file to add `looksLikeSheet`:

```ts
import { TagParser, capHistory, looksLikeSheet, type ParserHandlers } from "@/lib/refine-stream";
```

- [ ] **Step 1.2: Run the new tests — expect failure**

```bash
npm test -- lib/refine-stream.test.ts
```

Expected: 7 new tests fail with "looksLikeSheet is not exported" or similar TypeScript error. Existing tests still pass.

- [ ] **Step 1.3: Implement `looksLikeSheet` in `lib/refine-stream.ts`**

Add this exported function at the bottom of `lib/refine-stream.ts`, after the `capHistory` function (and before the `RefineHandlers` type or after, either works — pick a spot adjacent to other top-level helpers):

```ts
/**
 * Returns true if `text` looks like a cheat-sheet rather than a Q&A reply.
 * Used as the auto-detect heuristic to recover a misformatted edit turn —
 * see refine() for where it fires. A ## heading at the start of a line is
 * the strongest signal; 2+ ### subheads also qualify.
 */
export function looksLikeSheet(text: string): boolean {
  const hasH2 = /(^|\n)##\s+\S/.test(text);
  const subheadCount = (text.match(/(^|\n)###\s+\S/g) || []).length;
  return hasH2 || subheadCount >= 2;
}
```

- [ ] **Step 1.4: Run tests — expect pass**

```bash
npm test -- lib/refine-stream.test.ts
```

Expected: all tests pass (the 7 new + the existing TagParser/capHistory tests).

- [ ] **Step 1.5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 1.6: Commit**

```bash
git add lib/refine-stream.ts lib/refine-stream.test.ts
git commit -m "feat(refine): looksLikeSheet heuristic for misformatted-edit detection"
```

---

## Task 2: Wire `looksLikeSheet` into `refine()` post-stream

**Why:** This is the actual recovery — turns the heuristic into a behavior change. Three cases to handle (clean / reply-only-but-sheet-shaped / parser-errored-but-sheet-shaped).

**Files:**
- Modify: `lib/refine-stream.ts`
- Modify: `lib/refine-stream.test.ts`

- [ ] **Step 2.1: Add failing tests for the auto-detect path in `refine()`**

Add this `describe` block at the end of `lib/refine-stream.test.ts`. These tests use a `fetch` mock to drive `refine()` with controlled response bodies.

```ts
import { refine, type RefineHandlers } from "@/lib/refine-stream";

function mockStreamingFetch(body: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return vi.fn(async () => new Response(stream, { status: 200, headers: { "content-type": "text/plain" } }));
}

function makeRefineHandlers() {
  return {
    onReplyDelta: vi.fn<(text: string) => void>(),
    onSheetDelta: vi.fn<(text: string) => void>(),
    onSheetEdit: vi.fn<(full: string) => void>(),
    onDone: vi.fn<(args: { replyText: string; sheetEdited: boolean; parserError: string | null }) => void>(),
    onError: vi.fn<(message: string, code?: string) => void>(),
  } satisfies RefineHandlers;
}

const REFINE_INPUT = {
  apiKey: "test-key",
  subjectId: "subj_1",
  subjectName: "Biology",
  currentSheet: "## old sheet",
  history: [],
  message: "make it shorter",
};

describe("refine() auto-detect", () => {
  it("clean reply+sheet response: passes through unchanged", async () => {
    vi.stubGlobal("fetch", mockStreamingFetch("<reply>Done.</reply><sheet>## New sheet\n- item</sheet>"));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    expect(h.onSheetEdit).toHaveBeenCalledWith("## New sheet\n- item");
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "Done.",
      sheetEdited: true,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });

  it("clean reply-only response (Q&A): passes through unchanged", async () => {
    vi.stubGlobal("fetch", mockStreamingFetch("<reply>NADPH is a reducing agent.</reply>"));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    expect(h.onSheetEdit).not.toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "NADPH is a reducing agent.",
      sheetEdited: false,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });

  it("auto-detect: <reply> contains the full sheet rewrite — re-routes to onSheetEdit", async () => {
    const sheetMarkdown = "## Photosynthesis\n- Light reactions\n- Calvin cycle\n\n## Respiration\n- Glycolysis";
    vi.stubGlobal("fetch", mockStreamingFetch(`<reply>${sheetMarkdown}</reply>`));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    expect(h.onSheetEdit).toHaveBeenCalledWith(sheetMarkdown);
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "Updated the sheet ✓",
      sheetEdited: true,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });

  it("auto-detect: untagged sheet-shaped output — re-routes to onSheetEdit, clears any parser error", async () => {
    const sheetMarkdown = "## Photosynthesis\n- Light reactions\n- Calvin cycle";
    vi.stubGlobal("fetch", mockStreamingFetch(sheetMarkdown));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    expect(h.onSheetEdit).toHaveBeenCalledWith(sheetMarkdown);
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "Updated the sheet ✓",
      sheetEdited: true,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });

  it("auto-detect: unclosed <sheet> tag with sheet-shaped content — recovers, keeps original reply, no parser error surfaced", async () => {
    const partialSheet = "## Photosynthesis\n- Light reactions\n- Calvin cycle";
    vi.stubGlobal("fetch", mockStreamingFetch(`<reply>Done.</reply><sheet>${partialSheet}`));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    // Parser would have errored on the unclosed <sheet>, but recovery from the
    // exposed partialSheet fires onSheetEdit and the error is cleared. The
    // (already-parsed) reply "Done." is preserved as-is.
    expect(h.onSheetEdit).toHaveBeenCalledWith(partialSheet);
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "Done.",
      sheetEdited: true,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });

  it("plain Q&A prose: no auto-detect, no sheet edit", async () => {
    vi.stubGlobal("fetch", mockStreamingFetch("<reply>The Krebs cycle happens in the mitochondrial matrix.</reply>"));
    const h = makeRefineHandlers();
    await refine(REFINE_INPUT, h);
    expect(h.onSheetEdit).not.toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalledWith({
      replyText: "The Krebs cycle happens in the mitochondrial matrix.",
      sheetEdited: false,
      parserError: null,
    });
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2.2: Run tests — expect failure**

```bash
npm test -- lib/refine-stream.test.ts
```

Expected: 4 of the 6 new tests fail. The two "clean" tests pass (already correct in v2.1). The 4 auto-detect / recovery tests fail because the recovery logic doesn't exist yet.

- [ ] **Step 2.3a: Expose partial sheet content from `TagParser`**

The current `TagParser` drops partial sheet content when `<sheet>` opens but never closes (its `in_sheet` final-drain branch deliberately doesn't flush, to preserve the contract that `onSheetEdit` only fires for a complete sheet). For recovery, we need access to whatever content was accumulated under the `<sheet>` tag.

In `lib/refine-stream.ts`, modify the `TagParser` class:

1. Change the private `sheetBuffer` declaration:

```ts
private sheetBuffer = "";
```

to:

```ts
public sheetBuffer = "";
```

2. In the `end()` method, before the `state.kind === "in_sheet"` early-return that sets the error, flush any remaining `buffer` content into `sheetBuffer` so the recovery logic can read it. Find the `end()` method:

```ts
end(): void {
  // Final drain — any remaining buffer is treated as the current state's text.
  this.drain(true);
  if (this.state.kind === "in_reply") {
    this.error = "Reply tag was unclosed.";
    this.state = { kind: "done" };
    return;
  }
  if (this.state.kind === "in_sheet") {
    // Sheet never closed — discard partial sheet, surface error.
    this.error = "Sheet tag was unclosed; sheet edit discarded.";
    this.state = { kind: "done" };
    return;
  }
  this.state = { kind: "done" };
}
```

Replace the `in_sheet` branch body to accumulate the remaining buffer before erroring:

```ts
end(): void {
  // Final drain — any remaining buffer is treated as the current state's text.
  this.drain(true);
  if (this.state.kind === "in_reply") {
    this.error = "Reply tag was unclosed.";
    this.state = { kind: "done" };
    return;
  }
  if (this.state.kind === "in_sheet") {
    // Sheet never closed. Capture whatever content was buffered under <sheet>
    // into sheetBuffer so callers (refine() recovery) can inspect/recover it.
    // Still surface the error — the strict contract is "no onSheetEdit unless
    // the sheet closed cleanly". Recovery is opt-in by the caller.
    if (this.buffer.length > 0) {
      this.sheetBuffer += this.buffer;
      this.buffer = "";
    }
    this.error = "Sheet tag was unclosed; sheet edit discarded.";
    this.state = { kind: "done" };
    return;
  }
  this.state = { kind: "done" };
}
```

- [ ] **Step 2.3b: Modify `refine()` to add the auto-detect step**

Find the `refine()` function in the same file. Locate the existing `parser.end()` + `handlers.onDone({ ... })` calls inside the `try { while (true) { … } }` block. Replace them with this block:

```ts
    parser.end();

    // ── Auto-detect: recover sheet-shaped output ────────────────────
    // Defense-in-depth: if the model misformatted its response, try to
    // recover the sheet. Three cases:
    //   (a) clean parse, sheet emitted: pass through unchanged.
    //   (b) clean parse, no sheet emitted, but reply text looks like a
    //       sheet: fire onSheetEdit(replyText), replace reply with a
    //       short confirmation.
    //   (c) parser error (unclosed <sheet>) and the accumulated sheet
    //       buffer looks sheet-shaped: fire onSheetEdit(parser.sheetBuffer),
    //       keep the (cleanly-parsed) reply text as-is, clear the error.
    let finalReply = replyText;
    let finalSheetEdited = sheetEdited;
    let finalParserError = parser.error;

    if (!sheetEdited && looksLikeSheet(replyText)) {
      handlers.onSheetEdit(replyText);
      finalSheetEdited = true;
      finalReply = "Updated the sheet ✓";
      finalParserError = null;
    } else if (
      !sheetEdited &&
      parser.error &&
      parser.sheetBuffer.length > 0 &&
      looksLikeSheet(parser.sheetBuffer)
    ) {
      handlers.onSheetEdit(parser.sheetBuffer);
      finalSheetEdited = true;
      // Keep the original replyText if non-empty (e.g. "Done."); only
      // substitute when there's nothing to show.
      if (!finalReply) finalReply = "Updated the sheet ✓";
      finalParserError = null;
    }

    handlers.onDone({ replyText: finalReply, sheetEdited: finalSheetEdited, parserError: finalParserError });
```

Note: the existing code has `parser.end(); handlers.onDone({ replyText, sheetEdited, parserError: parser.error });` — those two lines are replaced by the block above.

- [ ] **Step 2.4: Run tests — expect pass**

```bash
npm test -- lib/refine-stream.test.ts
```

Expected: all tests pass.

- [ ] **Step 2.5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add lib/refine-stream.ts lib/refine-stream.test.ts
git commit -m "feat(refine): auto-detect sheet-shaped replies and route to onSheetEdit"
```

---

## Task 3: Tighten `REFINE_SYSTEM` prompt

**Why:** Reduces the failure rate that the parser auto-detect catches. No tests — prompt text is verified by manual E2E in Task 6.

**Files:**
- Modify: `lib/prompts.ts`

- [ ] **Step 3.1: Replace the `REFINE_SYSTEM` constant**

In `lib/prompts.ts`, find the existing `const REFINE_SYSTEM = \`…\`;` block (currently around lines 46–64). Replace its entire body with this exact string:

```ts
const REFINE_SYSTEM = `You are PufferStudy, helping a student refine a one-page cheat sheet they
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
one printed page. Do not apologize, do not praise.`;
```

- [ ] **Step 3.2: Run typecheck and tests (sanity)**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass. (Prompt text is just a string — won't break tests.)

- [ ] **Step 3.3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat(prompts): rewrite REFINE_SYSTEM with positive/negative tag examples"
```

---

## Task 4: Bubble height cap with "Show more"

**Why:** The visual safety net. Caps every assistant bubble (resolved AND streaming) so a runaway reply can never visually take over the page.

**Files:**
- Modify: `components/cheatsheet-chat.tsx`

- [ ] **Step 4.1: Add a `CappedBubble` helper component inside `cheatsheet-chat.tsx`**

Open `components/cheatsheet-chat.tsx`. The file already has a `MessageBubble` function at the bottom. We'll add a new `CappedBubble` helper above `MessageBubble` and use it for assistant content.

Add this near the top of the file, just after the existing `import` block:

```tsx
const BUBBLE_CAP_PX = 224; // ~14rem
```

Then, just above the existing `function MessageBubble(...)` near the bottom of the file, add:

```tsx
function CappedBubble({ children, fixedExpanded = false }: { children: React.ReactNode; fixedExpanded?: boolean }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  });

  const isExpanded = fixedExpanded || expanded;
  return (
    <div className="relative">
      <div
        ref={ref}
        style={isExpanded ? undefined : { maxHeight: `${BUBBLE_CAP_PX}px` }}
        className={cn("overflow-hidden", isExpanded ? "" : "")}
      >
        {children}
      </div>
      {!isExpanded && overflows ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--primary-bg-fade, rgba(107,191,138,0.12)) 100%)",
            }}
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute bottom-1 left-3 rounded-full border border-[var(--primary)]/30 bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] hover:bg-surface"
          >
            Show more ▾
          </button>
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4.2: Wrap the streaming bubble content with `CappedBubble`**

Find the existing block (inside the main `<section>` return) that renders the streaming bubble. Currently it looks like:

```tsx
{status.kind === "streaming" ? (
  <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {status.pendingAssistant || "_Thinking…_"}
      </ReactMarkdown>
    </div>
  </div>
) : null}
```

Replace it with:

```tsx
{status.kind === "streaming" ? (
  <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
    <CappedBubble>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {status.pendingAssistant || "_Thinking…_"}
        </ReactMarkdown>
      </div>
    </CappedBubble>
  </div>
) : null}
```

Note: streaming bubble does NOT show a "Show more" button (per the spec — auto-scroll-to-bottom mode while streaming). `CappedBubble` already handles this — `overflows` gets recomputed every render; the button is rendered only after the cap is hit AND the user hasn't clicked it. During streaming, the user sees text growing into the cap, then it stops growing visually (overflow hidden). That's the intended behavior.

- [ ] **Step 4.3: Apply `CappedBubble` to the resolved assistant bubble in `MessageBubble`**

At the bottom of the file, find the existing `MessageBubble` function. The assistant branch currently looks like:

```tsx
return (
  <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
    </div>
    {message.sheetEdited ? (
      <p className="mt-1 text-[11px] text-ink-faint">Sheet updated above.</p>
    ) : null}
  </div>
);
```

Replace it with:

```tsx
return (
  <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
    <CappedBubble>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </CappedBubble>
    {message.sheetEdited ? (
      <p className="mt-1 text-[11px] text-ink-faint">Sheet updated above.</p>
    ) : null}
  </div>
);
```

- [ ] **Step 4.4: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 4.5: Smoke-test in dev**

Run the dev server:
```bash
npm run dev
```

Then open `http://localhost:3000/subjects/<some-id>/cheatsheet`, send a question like "explain everything you know about photosynthesis in detail with examples and lots of subtopics" — verify the assistant bubble caps with a fade and a "Show more ▾" button, and clicking it expands the bubble inline.

If the cap shows up correctly, stop the dev server (Ctrl+C).

- [ ] **Step 4.6: Commit**

```bash
git add components/cheatsheet-chat.tsx
git commit -m "feat(chat): cap assistant bubble height with Show-more affordance"
```

---

## Task 5: Two-column layout on the cheatsheet page

**Why:** The structural piece — sheet and chat sit side-by-side on desktop with a sticky chat column. Final defense after auto-detect: the chat column is bounded so it cannot push the sheet around.

**Files:**
- Modify: `app/subjects/[id]/cheatsheet/page.tsx`
- Modify: `components/cheatsheet-chat.tsx`

- [ ] **Step 5.1: Widen the page container to 1280px**

Open `app/subjects/[id]/cheatsheet/page.tsx`. There are two `<div className="mx-auto w-full max-w-[1120px] …">` containers (one inside the `subject === undefined` skeleton branch, one in the main return).

Update **only the main-return container** (the one at line ~128). Change `max-w-[1120px]` → `max-w-[1280px]`. The skeleton's container stays at 1120 — keep loading states tighter.

Before:
```tsx
<div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-8 sm:py-12">
  <div className="no-print">
    <Link
      href={`/subjects/${subject.id}`}
      …
```

After:
```tsx
<div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
  <div className="no-print">
    <Link
      href={`/subjects/${subject.id}`}
      …
```

- [ ] **Step 5.2: Wrap sheet + chat in a two-column flex row**

Still in `app/subjects/[id]/cheatsheet/page.tsx`. Find the block at the bottom of the main return that renders `<CheatsheetView>` and then `<CheatsheetChat>`. Currently:

```tsx
      {showInitialCTA ? (
        <div className="no-print rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
          …Generate cheat sheet…
        </div>
      ) : state.kind === "loading" ? (
        <CheatsheetView
          markdown={state.partial || "_Reading your notes…_"}
          className="opacity-95"
        />
      ) : state.kind === "done" ? (
        <CheatsheetView markdown={state.markdown} />
      ) : (
        subject.cheatsheetMarkdown ? (
          <CheatsheetView markdown={subject.cheatsheetMarkdown} />
        ) : null
      )}

      {subject && state.kind !== "loading" && displayedSheet.length > 0 ? (
        <CheatsheetChat
          subjectId={subject.id}
          …
        />
      ) : null}
```

Wrap the two sections (sheet and chat) in a single flex container — **only when both render**. Refactor to:

```tsx
      {showInitialCTA ? (
        <div className="no-print rounded-[var(--radius-xl)] border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
          <p className="mb-6 text-[15px] text-ink-muted">
            Ready to turn {subject.files.length}{" "}
            {subject.files.length === 1 ? "file" : "files"} into a printable cheat sheet?
          </p>
          <Button onClick={start} size="lg" disabled={!hasKey}>
            <RefreshCcw />
            Generate cheat sheet
          </Button>
        </div>
      ) : state.kind === "loading" ? (
        <CheatsheetView
          markdown={state.partial || "_Reading your notes…_"}
          className="opacity-95"
        />
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-[3]">
            {state.kind === "done" ? (
              <CheatsheetView markdown={state.markdown} />
            ) : subject.cheatsheetMarkdown ? (
              <CheatsheetView markdown={subject.cheatsheetMarkdown} />
            ) : null}
          </div>
          {subject && displayedSheet.length > 0 ? (
            <div className="min-w-0 w-full lg:flex-[2] lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-6rem)]">
              <CheatsheetChat
                subjectId={subject.id}
                subjectName={subject.name}
                apiKey={apiKey}
                currentSheet={displayedSheet}
                messages={subject.chatMessages}
                onTurnComplete={async ({ nextMessages, nextSheet }) => {
                  // Optimistic: update local state immediately.
                  const optimistic = {
                    ...subject,
                    chatMessages: nextMessages,
                    ...(nextSheet !== null ? { cheatsheetMarkdown: nextSheet } : {}),
                  };
                  setSubject(optimistic);
                  if (nextSheet !== null) {
                    setState({ kind: "done", markdown: nextSheet });
                  }
                  // Persist atomically.
                  try {
                    const updated = await updateSubject(subject.id, {
                      chatMessages: nextMessages,
                      ...(nextSheet !== null ? { cheatsheetMarkdown: nextSheet } : {}),
                    });
                    setSubject({ ...subject, ...updated, files: subject.files, chatMessages: nextMessages });
                  } catch (err) {
                    console.error("Failed to persist chat turn:", err);
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      )}
```

Notes about this change:
- `min-w-0` on flex children is critical for proper text wrapping inside flex columns.
- The sticky behavior only kicks in at `lg:` (1024px+). Below that, both columns stack with `flex-col`.
- During `state.kind === "loading"` (initial cheatsheet generation), we keep the old full-width single-column behavior — chat isn't shown anyway because `displayedSheet` won't be ready yet.

- [ ] **Step 5.3: Drop the `max-w-[760px]` and `mx-auto` from the chat at `lg:`**

Open `components/cheatsheet-chat.tsx`. The top-level `<section>` currently is:

```tsx
<section className="no-print mx-auto mt-10 w-full max-w-[760px]">
```

Change to:

```tsx
<section className="no-print w-full mx-auto mt-10 max-w-[760px] lg:mx-0 lg:mt-0 lg:max-w-none">
```

This preserves the mobile constraint (centered, 760px max) and lets the chat fill its column on desktop.

- [ ] **Step 5.4: Add the dashed-divider mobile treatment**

Still in `components/cheatsheet-chat.tsx`. Wrap the existing section content with a mobile-only top border and section header. Update the `<section>` opening line and add the header right after it. Replace the opening of the return statement:

```tsx
return (
  <section className="no-print w-full mx-auto mt-10 max-w-[760px] lg:mx-0 lg:mt-0 lg:max-w-none">
    <h2 className="mb-4 text-sm font-medium text-ink-faint">Chat with this sheet</h2>
```

with:

```tsx
return (
  <section className="no-print w-full mx-auto mt-10 max-w-[760px] border-t border-dashed border-default pt-6 bg-surface-2/30 px-4 -mx-4 lg:mx-0 lg:mt-0 lg:max-w-none lg:border-t-0 lg:border-none lg:bg-transparent lg:px-0">
    <h2 className="mb-4 text-sm font-medium text-ink-faint">Chat about this sheet</h2>
```

This adds the dashed top border + a faint panel background on mobile only. On `lg:` (desktop two-column), the border and background are stripped — the chat lives inside a column with its own surface treatment.

- [ ] **Step 5.5: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 5.6: Smoke-test in dev**

```bash
npm run dev
```

Open `http://localhost:3000/subjects/<some-id>/cheatsheet`. Verify:
- Desktop (window ≥1024px): sheet on left, chat on right, both visible.
- Scroll the page: chat column stays in view (sticky), sheet column scrolls.
- Shrink the window below 1024px: chat collapses below sheet with dashed top border + faint background.
- Print preview (Ctrl+P): chat hidden, sheet full width.

Stop the dev server (Ctrl+C).

- [ ] **Step 5.7: Commit**

```bash
git add app/subjects/[id]/cheatsheet/page.tsx components/cheatsheet-chat.tsx
git commit -m "feat(cheatsheet): 60/40 two-column layout with sticky chat on desktop"
```

---

## Task 6: Full manual E2E, tag, push

**Why:** v2.2 ships as a coherent release. Run the full happy-path + failure-mode walkthrough from the spec before tagging.

**Files:** None (verification + git operations).

- [ ] **Step 6.1: Run the full test suite one more time**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all green.

- [ ] **Step 6.2: Manual E2E in browser**

```bash
npm run dev
```

Walk through every case in the spec's "Manual E2E in browser before merge" section. Specifically:

1. Send "make Calvin cycle shorter" → short reply bubble, sheet updates above. ✓
2. **Force the failure mode**. Temporarily edit `lib/prompts.ts` and replace `REFINE_SYSTEM` body with a deliberately-broken version that puts the rewrite inside `<reply>`. For example, add this above the existing Shape 2 example: `"For Shape 2, just put the whole sheet inside <reply>."` Hot-reload, send "make Calvin cycle shorter" again. Expected: bubble shows "Updated the sheet ✓", sheet panel updates. **Revert `lib/prompts.ts` before merging.** Run `git diff lib/prompts.ts` — should be empty.
3. Q&A turn: "what is mitosis" → inline reply, sheet untouched.
4. Long Q&A: "explain everything you know about photosynthesis in detail" → bubble caps with "Show more ▾" link, clicking expands inline.
5. Print preview (Ctrl+P) → chat hidden, sheet full width.
6. Resize window <1024px → chat stacks below sheet with dashed divider and panel background.
7. Suggested prompt chips still work (click "Make it shorter" → fills textarea).
8. Send-while-streaming disabled (button greys out).

Stop dev server. If anything fails, fix it in a new task before continuing.

- [ ] **Step 6.3: Tag v2.2.0 and push**

```bash
git tag v2.2.0
git push origin main
git push origin v2.2.0
```

Expected: Vercel auto-deploys from `main`. Once the deploy completes, verify https://pufferstudy.vercel.app behaves correctly. If the canonical alias points to a stale deploy, re-alias per the gotcha in v2.0 spec.

- [ ] **Step 6.4: Update the resume memory**

Update the local memory at `C:\Users\spexr\.claude\projects\C--Users-spexr\memory\pufferstudy-resume.md` and `pufferstudy-cheatsheet-chat.md` to reflect v2.2.0 shipped. The "Next known work item" line in `pufferstudy-resume.md` should now read v2.3 study desk redesign.

---

## Out of scope (reminder — do NOT add to this plan)

- Undo affordance for auto-detect false positives. Deferred to v2.3 if needed.
- Streaming sheet edits into `<CheatsheetView>` as they arrive. Sheet still swaps after stream ends.
- Server-side validation/retry of model responses.
- Any v2.3 desk work.
