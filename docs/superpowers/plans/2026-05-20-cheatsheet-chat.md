# Cheatsheet Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ChatGPT-style chatbox below the cheat sheet that auto-detects whether each user message is a Q&A or a sheet-edit request, streams the response (with optional sheet rewrite via tag protocol), and cloud-persists both the transcript and the edited sheet per subject.

**Architecture:** New `mode: "refine"` branch on the existing `/api/generate` route — same Gemini streaming pipe, but does NOT fetch original PDFs/images, only sees current sheet + chat history. Model emits tagged output (`<reply>…</reply>` always, `<sheet>…</sheet>` for edits). A new client-side state-machine parser routes deltas to the chat bubble and (when present) the full sheet rewrite. Persistence reuses `PATCH /api/subjects/[id]` extended with `chatMessages`. One JSONB column on the existing `subjects` table holds the per-subject transcript.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind v4, `@vercel/postgres` (Neon), `@vercel/blob`, Clerk auth, Gemini via REST streaming, vitest (NEW — added in Task 1).

**Spec:** `docs/superpowers/specs/2026-05-19-cheatsheet-chat-design.md`

---

## File Structure

**New files:**
| File | Responsibility |
|---|---|
| `vitest.config.ts` | vitest config — node env, includes `lib/**/*.test.ts` |
| `lib/refine-stream.ts` | Tag-protocol state-machine parser + `refine()` client function that calls `/api/generate` and routes deltas |
| `lib/refine-stream.test.ts` | Unit tests for the parser and the history-cap helper |
| `scripts/migrate-chat-messages.ts` | One-off script that runs `sql.query("ALTER TABLE …")` to add `chat_messages JSONB` |
| `components/cheatsheet-chat.tsx` | The `<CheatsheetChat>` UI component (message list, input, suggested chips) |

**Files modified:**
| File | Change |
|---|---|
| `package.json` | Add `vitest` devDep + `test` and `migrate:chat` scripts |
| `lib/prompts.ts` | Add `"refine"` to `GenerateMode`, export `REFINE_SYSTEM`, add `userPromptForRefine()` |
| `lib/subjects-db.ts` | Add `chat_messages` to `DbSubject` and the `updateSubject` patch type; persist new column |
| `lib/cloud-subjects.ts` | Add `chatMessages` to `Subject` + map both directions; extend `updateSubject` patch type |
| `app/api/generate/route.ts` | Add `mode: "refine"` branch that skips file fetch; new request body shape `currentSheet`, `history`, `message` |
| `app/api/subjects/[id]/route.ts` | Accept `chatMessages: ChatMessage[]` in PATCH body, pass through to `updateSubject` |
| `app/subjects/[id]/cheatsheet/page.tsx` | Render `<CheatsheetChat>` below `<CheatsheetView>` when a sheet exists; lift sheet state so chat can swap it after refine turns |

Tag parser lives in its own file (not in `lib/gemini-client.ts`) — `gemini-client.ts` is the existing raw streaming layer for all generate modes; refine has its own parsing concern and shouldn't pollute it.

---

## Task 1: Add vitest test framework

**Why first:** the parser (Task 4) is the highest-risk piece in this feature and demands unit tests. No test framework is installed today; we need one before TDD on the parser.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/refine-stream.test.ts` (smoke test only — real tests added in Task 4)

- [ ] **Step 1.1: Install vitest**

Run:
```bash
npm install --save-dev vitest@^2.1.9
```

Expected: vitest added under `devDependencies`. No peer-dep warnings should block install (Next 15 + React 19 + vitest 2 work fine).

- [ ] **Step 1.2: Add `test` and `migrate:chat` scripts to `package.json`**

In `package.json`, replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "migrate:chat": "node --import tsx scripts/migrate-chat-messages.ts"
}
```

Also install `tsx` so the migrate script can run TS without a build step:

```bash
npm install --save-dev tsx@^4.19.0
```

- [ ] **Step 1.3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 1.4: Add a smoke test to prove vitest is wired**

Create `lib/refine-stream.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 1.5: Run the smoke test**

Run: `npm test`
Expected: `1 passed`, exit 0.

- [ ] **Step 1.6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/refine-stream.test.ts
git commit -m "chore: add vitest + tsx for unit tests and DDL migration scripts"
```

---

## Task 2: DB migration — add `chat_messages` column

**Critical gotcha (from `[[pufferstudy-resume]]` memory):** `@vercel/postgres` `sql\`\`\`` tagged template **silently swallows DDL**. You MUST use `sql.query("ALTER ...")`. Don't refactor this to the template form.

**Files:**
- Create: `scripts/migrate-chat-messages.ts`

- [ ] **Step 2.1: Write the migration script**

```ts
// scripts/migrate-chat-messages.ts
import "dotenv/config";
import { sql } from "@vercel/postgres";

async function main() {
  console.log("Adding chat_messages column to subjects...");

  // MUST use sql.query() for DDL. The tagged template silently no-ops.
  const result = await sql.query(
    `ALTER TABLE subjects
       ADD COLUMN IF NOT EXISTS chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb`,
  );
  console.log("ALTER returned:", result.command, "rowCount:", result.rowCount);

  // Verify the column exists
  const check = await sql.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'subjects' AND column_name = 'chat_messages'`,
  );
  console.log("Verification:", check.rows);

  if (check.rows.length === 0) {
    console.error("FAIL: chat_messages column not found after ALTER.");
    process.exit(1);
  }
  console.log("OK: chat_messages column exists.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2.2: Pull env vars locally**

Run: `vercel env pull .env.local`
Expected: `.env.local` populated with `POSTGRES_URL` etc.

(If `vercel` CLI isn't logged in: `vercel login` first.)

- [ ] **Step 2.3: Run the migration against the live Neon DB**

Run: `npm run migrate:chat`
Expected output:
```
Adding chat_messages column to subjects...
ALTER returned: ALTER rowCount: null
Verification: [ { column_name: 'chat_messages', data_type: 'jsonb' } ]
OK: chat_messages column exists.
```

**If verification rows are empty:** the tagged template gotcha may have bitten — confirm you used `sql.query(...)`, not `` sql`...` ``. Re-run.

- [ ] **Step 2.4: Commit**

```bash
git add scripts/migrate-chat-messages.ts
git commit -m "feat(db): migration script for chat_messages JSONB column on subjects"
```

---

## Task 3: Types + DB layer wire-through

Plumb the new column through `lib/subjects-db.ts` (server) and `lib/cloud-subjects.ts` (client) so reads and writes round-trip the chat transcript.

**Files:**
- Modify: `lib/subjects-db.ts`
- Modify: `lib/cloud-subjects.ts`
- Modify: `types.ts` (extend `ChatMessage` with optional `sheetEdited`)

- [ ] **Step 3.1: Extend `ChatMessage` in `types.ts`**

In `types.ts`, replace the existing `ChatMessage` type:

```ts
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
  sheetEdited?: boolean;
};
```

- [ ] **Step 3.2: Update `DbSubject` and `updateSubject` in `lib/subjects-db.ts`**

In `lib/subjects-db.ts`:

**A. Add `chat_messages` to `DbSubject`** (line 4–14 area):

```ts
export type DbSubject = {
  id: string;
  user_id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  chat_messages: ChatMessage[];     // NEW
  created_at: string;
  updated_at: string;
};
```

Add at the top:

```ts
import type { ChatMessage } from "@/types";
```

**B. Extend the `updateSubject` patch type and SQL** (line 70–108 area):

Replace the `updateSubject` function body so it also accepts `chatMessages`:

```ts
export async function updateSubject(
  userId: string,
  subjectId: string,
  patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
  },
): Promise<DbSubject | null> {
  const noFields =
    patch.name === undefined &&
    patch.testLabel === undefined &&
    patch.testDate === undefined &&
    patch.cheatsheetMarkdown === undefined &&
    patch.chatMessages === undefined;

  if (noFields) {
    const { rows } = await sql<DbSubject>`
      SELECT * FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}
    `;
    return rows[0] ?? null;
  }

  const cheatsheetTimestamp = patch.cheatsheetMarkdown !== undefined ? new Date().toISOString() : null;
  const chatJson = patch.chatMessages !== undefined ? JSON.stringify(patch.chatMessages) : null;

  const { rows } = await sql<DbSubject>`
    UPDATE subjects
    SET
      name = COALESCE(${patch.name ?? null}, name),
      test_label = CASE WHEN ${patch.testLabel === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testLabel ?? null} ELSE test_label END,
      test_date = CASE WHEN ${patch.testDate === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testDate ?? null}::date ELSE test_date END,
      cheatsheet_markdown = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.cheatsheetMarkdown ?? null} ELSE cheatsheet_markdown END,
      cheatsheet_generated_at = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${cheatsheetTimestamp}::timestamptz ELSE cheatsheet_generated_at END,
      chat_messages = CASE WHEN ${patch.chatMessages === undefined ? "no" : "yes"}::text = 'yes' THEN ${chatJson}::jsonb ELSE chat_messages END,
      updated_at = now()
    WHERE id = ${subjectId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}
```

- [ ] **Step 3.3: Update `Subject` + `mapSubject` + `updateSubject` in `lib/cloud-subjects.ts`**

In `lib/cloud-subjects.ts`:

**A. Import `ChatMessage` at the top:**

```ts
import type { ChatMessage } from "@/types";
```

**B. Add `chatMessages` to `Subject`** (line 5–14):

```ts
export type Subject = {
  id: string;
  name: string;
  testLabel: string | null;
  testDate: string | null;
  cheatsheetMarkdown: string | null;
  cheatsheetGeneratedAt: string | null;
  chatMessages: ChatMessage[];    // NEW
  createdAt: string;
  updatedAt: string;
};
```

**C. Add `chat_messages` to the internal `DbSubject` type** (line 28–37):

```ts
type DbSubject = {
  id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  chat_messages: ChatMessage[];    // NEW
  created_at: string;
  updated_at: string;
};
```

**D. Update `mapSubject`** (line 49–60):

```ts
function mapSubject(row: DbSubject): Subject {
  return {
    id: row.id,
    name: row.name,
    testLabel: row.test_label,
    testDate: row.test_date,
    cheatsheetMarkdown: row.cheatsheet_markdown,
    cheatsheetGeneratedAt: row.cheatsheet_generated_at,
    chatMessages: row.chat_messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

**E. Extend the `updateSubject` patch type** (line 107–124). Replace the function with:

```ts
export async function updateSubject(
  id: string,
  patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
  },
): Promise<Subject> {
  const res = await fetch(`/api/subjects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateSubject ${res.status}`);
  const data = (await res.json()) as { subject: DbSubject };
  return mapSubject(data.subject);
}
```

- [ ] **Step 3.4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (zero errors).

If failures: most likely a place that destructures `Subject` and asserts shape — chase the type errors back to the call site and update.

- [ ] **Step 3.5: Commit**

```bash
git add types.ts lib/subjects-db.ts lib/cloud-subjects.ts
git commit -m "feat(db): plumb chat_messages through DB and client subject types"
```

---

## Task 4: Tag-protocol parser (TDD)

The model emits either:
- `<reply>markdown</reply>` — Q&A turn
- `<reply>one-line summary</reply><sheet>FULL new sheet</sheet>` — edit turn

Or if it misbehaves: missing tags (treat all as reply), or `<sheet>` that never closes (discard sheet, surface error).

The parser is a state machine that consumes streaming text chunks and fires three callbacks: `onReplyDelta`, `onSheetDelta`, `onSheetEdit`.

**Files:**
- Create: `lib/refine-stream.ts`
- Replace: `lib/refine-stream.test.ts` (smoke test from Task 1 → real tests)

- [ ] **Step 4.1: Write failing parser tests**

Replace the contents of `lib/refine-stream.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { TagParser, capHistory, type ParserHandlers } from "@/lib/refine-stream";
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
    // partial reply text still streamed so user sees something
    const replyText = h.onReplyDelta.mock.calls.map((c) => c[0]).join("");
    expect(replyText).toBe("Started but never closed");
    expect(p.error).toMatch(/reply.*unclosed/i);
  });
});

describe("capHistory", () => {
  function msg(role: ChatMessage["role"], content: string): ChatMessage {
    return { role, content, ts: "2026-01-01T00:00:00.000Z" };
  }

  it("returns history unchanged when ≤ 10 messages", () => {
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
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `npm test`
Expected: tests fail with module-not-found / cannot-find `@/lib/refine-stream`.

- [ ] **Step 4.3: Implement the parser + helpers in `lib/refine-stream.ts`**

```ts
// lib/refine-stream.ts
"use client";

import type { ChatMessage } from "@/types";

export type ParserHandlers = {
  onReplyDelta: (text: string) => void;
  onSheetDelta?: (text: string) => void;
  onSheetEdit: (full: string) => void;
};

type State =
  | { kind: "start" }              // before any tag opens
  | { kind: "in_reply" }
  | { kind: "between" }            // </reply> seen, before <sheet> or end
  | { kind: "in_sheet" }
  | { kind: "done" };

const REPLY_OPEN = "<reply>";
const REPLY_CLOSE = "</reply>";
const SHEET_OPEN = "<sheet>";
const SHEET_CLOSE = "</sheet>";

// Worst-case prefix that COULD be the start of any of the tags we care about.
// We never flush text that ends with such a prefix until we have more bytes.
const MAX_TAG_LEN = Math.max(
  REPLY_OPEN.length,
  REPLY_CLOSE.length,
  SHEET_OPEN.length,
  SHEET_CLOSE.length,
);

export class TagParser {
  private state: State = { kind: "start" };
  private buffer = "";
  private sheetBuffer = "";
  private replyEmittedAny = false;
  public error: string | null = null;

  constructor(private h: ParserHandlers) {}

  write(chunk: string): void {
    if (this.state.kind === "done") return;
    this.buffer += chunk;
    this.drain();
  }

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

  private drain(final = false): void {
    // Loop because a single chunk can carry multiple state transitions.
    while (true) {
      if (this.state.kind === "start") {
        const openIdx = this.buffer.indexOf(REPLY_OPEN);
        if (openIdx === -1) {
          if (final) {
            // No tags at all — model misbehaved. Treat the whole thing as reply text.
            if (this.buffer.length > 0) {
              this.h.onReplyDelta(this.buffer);
              this.replyEmittedAny = true;
              this.buffer = "";
            }
            return;
          }
          // Could a partial tag be at the end? If buffer might contain a prefix of <reply>,
          // do not emit anything; just wait for more input.
          return;
        }
        // If the model emitted text before <reply>, also stream it as reply (charitable).
        if (openIdx > 0) {
          this.h.onReplyDelta(this.buffer.slice(0, openIdx));
          this.replyEmittedAny = true;
        }
        this.buffer = this.buffer.slice(openIdx + REPLY_OPEN.length);
        this.state = { kind: "in_reply" };
        continue;
      }

      if (this.state.kind === "in_reply") {
        const closeIdx = this.buffer.indexOf(REPLY_CLOSE);
        if (closeIdx === -1) {
          // Emit everything we can safely emit (i.e. minus the last MAX_TAG_LEN-1 bytes,
          // which might be the start of </reply>).
          const safe = final ? this.buffer.length : Math.max(0, this.buffer.length - (MAX_TAG_LEN - 1));
          if (safe > 0) {
            this.h.onReplyDelta(this.buffer.slice(0, safe));
            this.replyEmittedAny = true;
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        if (closeIdx > 0) {
          this.h.onReplyDelta(this.buffer.slice(0, closeIdx));
          this.replyEmittedAny = true;
        }
        this.buffer = this.buffer.slice(closeIdx + REPLY_CLOSE.length);
        this.state = { kind: "between" };
        continue;
      }

      if (this.state.kind === "between") {
        // We're between </reply> and (optional) <sheet>. Skip whitespace; look for <sheet>.
        // If end-of-stream and no <sheet>, we're done.
        const openIdx = this.buffer.indexOf(SHEET_OPEN);
        if (openIdx === -1) {
          if (final) {
            this.state = { kind: "done" };
            return;
          }
          // Wait for more input.
          return;
        }
        // Anything before <sheet> is discarded (typically just whitespace/newlines).
        this.buffer = this.buffer.slice(openIdx + SHEET_OPEN.length);
        this.state = { kind: "in_sheet" };
        continue;
      }

      if (this.state.kind === "in_sheet") {
        const closeIdx = this.buffer.indexOf(SHEET_CLOSE);
        if (closeIdx === -1) {
          const safe = final ? 0 : Math.max(0, this.buffer.length - (MAX_TAG_LEN - 1));
          if (safe > 0) {
            const piece = this.buffer.slice(0, safe);
            this.sheetBuffer += piece;
            this.h.onSheetDelta?.(piece);
            this.buffer = this.buffer.slice(safe);
          }
          return;
        }
        const piece = this.buffer.slice(0, closeIdx);
        if (piece.length > 0) {
          this.sheetBuffer += piece;
          this.h.onSheetDelta?.(piece);
        }
        this.buffer = this.buffer.slice(closeIdx + SHEET_CLOSE.length);
        this.h.onSheetEdit(this.sheetBuffer);
        this.state = { kind: "done" };
        return;
      }

      // state.kind === "done"
      return;
    }
  }
}

// Caps the chat history to the last N turns before sending to the model.
const HISTORY_CAP = 10;
export function capHistory(history: ChatMessage[]): ChatMessage[] {
  if (history.length <= HISTORY_CAP) return history;
  return history.slice(history.length - HISTORY_CAP);
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `npm test`
Expected: all 8 tests pass.

If a test fails: the most common bug is the mid-tag-boundary case. Confirm `MAX_TAG_LEN - 1` is the safe-emit threshold and the loop continues after each state transition.

- [ ] **Step 4.5: Commit**

```bash
git add lib/refine-stream.ts lib/refine-stream.test.ts
git commit -m "feat(refine): tag-protocol parser and history cap helper with unit tests"
```

---

## Task 5: Server route — add `refine` mode

Add a new branch to `/api/generate` that:
- Validates `mode === "refine"`
- Does NOT call `getFilesByIds` or `blobUrlToBase64`
- Reads `currentSheet`, `history`, `message` from body
- Sends `[history] + [user message with sheet injected]` to Gemini with a new `REFINE_SYSTEM` instruction describing the tag protocol

**Files:**
- Modify: `lib/prompts.ts`
- Modify: `app/api/generate/route.ts`

- [ ] **Step 5.1: Extend `GenerateMode` and add the refine prompt in `lib/prompts.ts`**

In `lib/prompts.ts`:

**A. Update the union (line 3):**

```ts
export type GenerateMode = "cheatsheet" | "chat" | "practice" | "refine";
```

**B. Add the refine system prompt** (anywhere with the other constants):

```ts
const REFINE_SYSTEM = `You are PufferStudy, helping a student refine a one-page cheat sheet they have already generated, and answering quick questions about the subject.

The student's CURRENT CHEAT SHEET will be provided inside <currentSheet>…</currentSheet>. The conversation history will be provided as prior turns. The new user message is the latest turn.

You will respond with strictly-tagged output. There are two response shapes:

1) Q&A turn — when the user is asking a question about the subject (not asking you to change the sheet). Output ONLY:
<reply>your markdown answer here, 1–3 short paragraphs</reply>

2) Edit turn — when the user is asking you to change, add to, shorten, or restructure the cheat sheet. Output BOTH:
<reply>one short sentence confirming what you changed</reply><sheet>THE COMPLETE rewritten cheat sheet in Markdown — not a diff, not a snippet, the whole sheet</sheet>

Rules:
- Decide between Q&A and Edit from the message. "Make it shorter", "add more on X", "remove Y" → Edit. "Explain Z", "what is W" → Q&A.
- The full <sheet> rewrite must include EVERYTHING that should remain on the sheet, not just the changed part.
- Never include text outside the tags. Never use code fences around the tags.
- Keep the same style as the original sheet: ## sections, ### sub-topics, bullet lists, **bold key terms**, formulas/dates preserved.
- Be concise. The sheet should still fit roughly one printed page.
- Do not apologize, do not praise, do not preamble.`;
```

**C. Wire it into `systemPromptFor`:**

```ts
export function systemPromptFor(mode: GenerateMode): string {
  switch (mode) {
    case "cheatsheet": return CHEATSHEET_SYSTEM;
    case "chat":       return CHAT_SYSTEM;
    case "practice":   return PRACTICE_SYSTEM;
    case "refine":     return REFINE_SYSTEM;
  }
}
```

**D. Add a `userPromptForRefine` helper:**

```ts
type RefineUserInput = {
  subjectName: string;
  currentSheet: string;
  message: string;
};

export function userPromptForRefine(input: RefineUserInput): string {
  return `Subject: ${input.subjectName}.

<currentSheet>
${input.currentSheet}
</currentSheet>

Student message: ${input.message}`;
}
```

- [ ] **Step 5.2: Add the refine branch in `app/api/generate/route.ts`**

In `app/api/generate/route.ts`:

**A. Import the new prompt helper.** Update the existing import block (line 3–9):

```ts
import {
  systemPromptFor,
  userPromptForCheatsheet,
  userPromptForChat,
  userPromptForPractice,
  userPromptForRefine,
  type GenerateMode,
} from "@/lib/prompts";
```

**B. Extend the `Body` type** (line 18–26):

```ts
type Body = {
  apiKey: string;
  mode: GenerateMode;
  subjectName: string;
  testLabel?: string;
  fileIds: string[];
  question?: string;
  history?: ChatMessage[];
  currentSheet?: string;   // refine mode only
  message?: string;        // refine mode only
};
```

**C. Update the mode validation** (line 61):

```ts
if (mode !== "cheatsheet" && mode !== "chat" && mode !== "practice" && mode !== "refine") {
  return bad(400, "Mode must be cheatsheet, chat, practice, or refine.");
}
```

**D. Branch off BEFORE the file fetch for refine mode.** Replace the block from line 67 (`if (!Array.isArray(fileIds))`) through line 124 (the `contents.push({ role: "user", parts });` line) with:

```ts
  if (!Array.isArray(fileIds)) {
    return bad(400, "fileIds must be an array.");
  }
  if (mode !== "chat" && mode !== "refine" && fileIds.length === 0) {
    return bad(400, "Add at least one file before generating.");
  }

  let userPrompt: string;
  let validFiles: Array<{ mimeType: string; data: string }> = [];
  const captions: string[] = [];

  if (mode === "refine") {
    if (typeof body.currentSheet !== "string" || !body.currentSheet.trim()) {
      return bad(400, "Refine requires a non-empty currentSheet.");
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return bad(400, "Refine requires a message.");
    }
    userPrompt = userPromptForRefine({
      subjectName,
      currentSheet: body.currentSheet,
      message: body.message,
    });
  } else {
    // Fetch the files the user owns from DB, then download blobs in parallel
    const records = await getFilesByIds(userId, fileIds);
    for (const r of records) captions.push(r.caption ?? "");
    const inlinedFiles = await Promise.all(
      records.map((r) => blobUrlToBase64(r.blob_url)),
    );
    validFiles = inlinedFiles.filter((f): f is { mimeType: string; data: string } => f !== null);

    if (mode === "cheatsheet") {
      userPrompt = userPromptForCheatsheet({
        subjectName,
        testLabel: body.testLabel,
        captions,
      });
    } else if (mode === "practice") {
      userPrompt = userPromptForPractice({ subjectName, captions });
    } else {
      if (typeof body.question !== "string" || !body.question.trim()) {
        return bad(400, "Chat requires a question.");
      }
      userPrompt = userPromptForChat({
        subjectName,
        question: body.question,
        history: body.history ?? [],
        captions,
      });
    }
  }

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: userPrompt }];
  for (const f of validFiles) {
    parts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
  }

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
  }> = [];

  if ((mode === "chat" || mode === "refine") && body.history && body.history.length > 0) {
    for (const m of body.history) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  contents.push({ role: "user", parts });
```

**E. Update `responseMimeType` so refine is `text/plain`** (line 141 — already the default, just confirm the `practice` check is unchanged):

```ts
responseMimeType: mode === "practice" ? "application/json" : "text/plain",
```

(No change needed; refine falls into the `text/plain` branch.)

- [ ] **Step 5.3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5.4: Commit**

```bash
git add lib/prompts.ts app/api/generate/route.ts
git commit -m "feat(api): add refine mode to /api/generate with tag-protocol system prompt"
```

---

## Task 6: PATCH `/api/subjects/[id]` accepts `chatMessages`

Pass `chatMessages` from the request body into the existing `updateSubject` call.

**Files:**
- Modify: `app/api/subjects/[id]/route.ts`

- [ ] **Step 6.1: Extend the PATCH handler**

In `app/api/subjects/[id]/route.ts`:

**A. Import `ChatMessage`:** add to the imports at the top:

```ts
import type { ChatMessage } from "@/types";
```

**B. Replace the PATCH function body (line 23–68)** — keeping the same signature, extend the request type and pass-through:

```ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
  } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (trimmed.length > 120) return NextResponse.json({ error: "name_too_long" }, { status: 400 });
    patch.name = trimmed;
  }
  if (body.testLabel !== undefined) {
    patch.testLabel = body.testLabel?.toString().trim() || null;
  }
  if (body.testDate !== undefined) {
    patch.testDate = body.testDate?.toString().trim() || null;
  }
  if (body.cheatsheetMarkdown !== undefined) {
    patch.cheatsheetMarkdown = body.cheatsheetMarkdown;
  }
  if (body.chatMessages !== undefined) {
    if (!Array.isArray(body.chatMessages)) {
      return NextResponse.json({ error: "chat_messages_invalid" }, { status: 400 });
    }
    // Light shape validation to keep junk out of the JSONB column.
    for (const m of body.chatMessages) {
      if (
        !m ||
        typeof m !== "object" ||
        (m.role !== "user" && m.role !== "assistant") ||
        typeof m.content !== "string" ||
        typeof m.ts !== "string"
      ) {
        return NextResponse.json({ error: "chat_message_shape" }, { status: 400 });
      }
    }
    patch.chatMessages = body.chatMessages;
  }

  const updated = await updateSubject(userId, id, patch);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ subject: updated });
}
```

- [ ] **Step 6.2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add app/api/subjects/[id]/route.ts
git commit -m "feat(api): PATCH /api/subjects/[id] accepts chatMessages with shape validation"
```

---

## Task 7: `<CheatsheetChat />` component

The component owns the chat UI and the per-turn streaming flow. It receives the current sheet and chat history as props plus callbacks to update them. It does NOT do persistence directly — that's the page's job (Task 8), so the chat stays independently testable and the page can decide when to PATCH.

**Files:**
- Create: `components/cheatsheet-chat.tsx`
- Modify: `lib/refine-stream.ts` — add a `refine()` client function alongside the parser

- [ ] **Step 7.1: Add `refine()` client function in `lib/refine-stream.ts`**

Append to `lib/refine-stream.ts`:

```ts
export type RefineHandlers = {
  onReplyDelta: (text: string) => void;
  onSheetDelta?: (text: string) => void;
  onSheetEdit: (full: string) => void;
  onDone: (args: { replyText: string; sheetEdited: boolean; parserError: string | null }) => void;
  onError: (message: string, code?: string) => void;
  signal?: AbortSignal;
};

type RefineInput = {
  apiKey: string;
  subjectId: string;
  subjectName: string;
  currentSheet: string;
  history: ChatMessage[];
  message: string;
};

export async function refine(input: RefineInput, handlers: RefineHandlers): Promise<void> {
  if (!input.apiKey) {
    handlers.onError("Add your Gemini API key in Settings first.", "missing_key");
    return;
  }

  const cappedHistory = capHistory(input.history);

  let replyText = "";
  let sheetEdited = false;
  const parser = new TagParser({
    onReplyDelta: (t) => {
      replyText += t;
      handlers.onReplyDelta(t);
    },
    onSheetDelta: handlers.onSheetDelta,
    onSheetEdit: (full) => {
      sheetEdited = true;
      handlers.onSheetEdit(full);
    },
  });

  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: input.apiKey,
        mode: "refine",
        subjectName: input.subjectName,
        fileIds: [],
        history: cappedHistory,
        currentSheet: input.currentSheet,
        message: input.message,
      }),
      signal: handlers.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("Couldn't reach the PufferStudy server. Check your connection.", "network");
    return;
  }

  if (!res.ok || !res.body) {
    let code = "unknown";
    let message = `Refinement failed (${res.status}).`;
    try {
      const json = (await res.json()) as { error?: string; message?: string };
      if (json.error) code = json.error;
      if (json.message) message = json.message;
    } catch {
      // body wasn't JSON
    }
    handlers.onError(message, code);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) parser.write(chunk);
    }
    parser.end();
    handlers.onDone({ replyText, sheetEdited, parserError: parser.error });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError("The stream was interrupted. Try again.", "stream_failed");
  }
}
```

- [ ] **Step 7.2: Build the component**

Create `components/cheatsheet-chat.tsx`:

```tsx
"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { refine } from "@/lib/refine-stream";
import type { ChatMessage } from "@/types";

const SUGGESTED_PROMPTS = [
  "Make it shorter",
  "Add more examples",
  "Quiz me on this",
] as const;

type ChatStatus =
  | { kind: "idle" }
  | { kind: "streaming"; pendingAssistant: string }
  | { kind: "error"; message: string };

type Props = {
  subjectId: string;
  subjectName: string;
  apiKey: string | null;
  currentSheet: string;          // "" when no sheet yet
  messages: ChatMessage[];
  onTurnComplete: (args: {
    nextMessages: ChatMessage[];
    nextSheet: string | null;    // null when the turn was Q&A only
  }) => void;
};

export function CheatsheetChat({
  subjectId,
  subjectName,
  apiKey,
  currentSheet,
  messages,
  onTurnComplete,
}: Props) {
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<ChatStatus>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Stick to bottom on new messages or new streamed text.
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const disabled =
    !apiKey ||
    currentSheet.length === 0 ||
    status.kind === "streaming";

  const placeholder =
    currentSheet.length === 0
      ? "Generate the cheat sheet first to start chatting"
      : !apiKey
        ? "Add your Gemini API key in Settings to chat"
        : "Ask a question or ask me to change the sheet…";

  const send = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || disabled || !apiKey) return;

      const userMsg: ChatMessage = {
        role: "user",
        content: text,
        ts: new Date().toISOString(),
      };
      const baseMessages = [...messages, userMsg];

      setInput("");
      setStatus({ kind: "streaming", pendingAssistant: "" });

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      let sheetFromTurn: string | null = null;

      await refine(
        {
          apiKey,
          subjectId,
          subjectName,
          currentSheet,
          history: baseMessages,   // includes the new user message
          message: text,
        },
        {
          signal: ac.signal,
          onReplyDelta: (t) => {
            setStatus((prev) =>
              prev.kind === "streaming"
                ? { kind: "streaming", pendingAssistant: prev.pendingAssistant + t }
                : prev,
            );
          },
          onSheetEdit: (full) => {
            sheetFromTurn = full;
          },
          onDone: ({ replyText, sheetEdited, parserError }) => {
            if (parserError) {
              setStatus({ kind: "error", message: parserError });
              return;
            }
            const assistantMsg: ChatMessage = {
              role: "assistant",
              content: replyText || (sheetEdited ? "Updated the sheet." : ""),
              ts: new Date().toISOString(),
              sheetEdited: sheetEdited || undefined,
            };
            const nextMessages = [...baseMessages, assistantMsg];
            setStatus({ kind: "idle" });
            onTurnComplete({
              nextMessages,
              nextSheet: sheetEdited ? sheetFromTurn : null,
            });
          },
          onError: (message) => {
            setStatus({ kind: "error", message });
          },
        },
      );
    },
    [apiKey, currentSheet, disabled, messages, onTurnComplete, subjectId, subjectName],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <section className="no-print mx-auto mt-10 w-full max-w-[760px]">
      <h2 className="mb-4 text-sm font-medium text-ink-faint">Chat with this sheet</h2>

      <div
        ref={listRef}
        className="mb-4 max-h-[480px] space-y-3 overflow-y-auto rounded-[var(--radius-lg)] border border-default bg-surface px-4 py-4"
      >
        {messages.length === 0 && status.kind === "idle" ? (
          <p className="text-sm text-ink-muted">
            Ask anything about this subject, or tell me how to change the sheet above.
          </p>
        ) : null}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {status.kind === "streaming" ? (
          <div className="rounded-[var(--radius-md)] bg-[var(--primary)]/8 px-3 py-2 text-sm text-ink">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {status.pendingAssistant || "_Thinking…_"}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}

        {status.kind === "error" ? (
          <div role="alert" className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
            <p>{status.message}</p>
          </div>
        ) : null}
      </div>

      {messages.length === 0 && status.kind !== "streaming" ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => setInput(p)}
              className="rounded-full border border-default bg-surface px-3 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className={cn(
            "flex-1 resize-none rounded-[24px] border border-default bg-surface px-4 py-3 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || input.trim().length === 0}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-ink-faint">Powered by your Gemini key.</p>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="rounded-[var(--radius-md)] border border-default bg-surface-2/40 px-3 py-2 text-sm text-ink">
        {message.content}
      </div>
    );
  }
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
}
```

- [ ] **Step 7.3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

If `<Button size="icon">` isn't a supported variant in this repo's `components/ui/button.tsx`, drop `size="icon"` — it's cosmetic.

- [ ] **Step 7.4: Commit**

```bash
git add components/cheatsheet-chat.tsx lib/refine-stream.ts
git commit -m "feat(ui): CheatsheetChat component + refine() client wrapper"
```

---

## Task 8: Mount the chat on the cheatsheet page + wire persistence

Lift the displayed sheet markdown into a single piece of state on the page so the chat can swap it on refine turns. Persist `{cheatsheetMarkdown?, chatMessages}` to the server after every assistant turn.

**Files:**
- Modify: `app/subjects/[id]/cheatsheet/page.tsx`

- [ ] **Step 8.1: Replace the cheatsheet page**

Open `app/subjects/[id]/cheatsheet/page.tsx`. Apply the following changes:

**A. Update imports at the top — add `CheatsheetChat`:**

```tsx
import { CheatsheetChat } from "@/components/cheatsheet-chat";
```

**B. Inside `CheatsheetPage`, after the existing `useSubject` line, add a derived `apiKey` and lift the displayed sheet to local state.** Find:

```tsx
  const { subject, setSubject } = useSubject(id);
  const [hasKey, setHasKey] = React.useState<boolean>(false);
  const [state, setState] = React.useState<GenState>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);
```

Replace with:

```tsx
  const { subject, setSubject } = useSubject(id);
  const [hasKey, setHasKey] = React.useState<boolean>(false);
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [state, setState] = React.useState<GenState>({ kind: "idle" });
  const abortRef = React.useRef<AbortController | null>(null);
```

**C. Update the settings effect to also capture the key:**

```tsx
  React.useEffect(() => {
    const key = getSettings().geminiKey;
    setHasKey(!!key);
    setApiKey(key ?? null);
  }, []);
```

**D. Compute the displayed sheet markdown.** Add just before the `return`:

```tsx
  // The "live" sheet: whatever the page is currently showing the user.
  // Generation flow updates `state`; refine flow updates the subject via PATCH.
  const displayedSheet =
    state.kind === "done"
      ? state.markdown
      : state.kind === "loading"
        ? state.partial
        : subject?.cheatsheetMarkdown ?? "";
```

**E. Render the chat below the sheet.** Find the closing `</div>` of the outer container at the end of the JSX (line ~227, `</div>` after the cheatsheet render branches). Just before that closing `</div>`, add:

```tsx
      {subject && state.kind !== "loading" && displayedSheet.length > 0 ? (
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
      ) : null}
```

- [ ] **Step 8.2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8.3: Lint**

Run: `npm run lint`
Expected: PASS (or known-clean warnings only).

- [ ] **Step 8.4: Build**

Run: `npm run build`
Expected: PASS. Build catches more than typecheck for App Router.

- [ ] **Step 8.5: Commit**

```bash
git add app/subjects/[id]/cheatsheet/page.tsx
git commit -m "feat(ui): mount CheatsheetChat below the cheatsheet with cloud persistence"
```

---

## Task 9: Manual end-to-end + push

The parser is unit-tested but the full loop (Gemini → tags → UI → DB → cross-device) is not. Test it in a real browser before merging.

**Files:** none (manual)

- [ ] **Step 9.1: Run dev server**

Run: `npm run dev`
Open `http://localhost:3000` in a browser.

- [ ] **Step 9.2: Sign in and pick a subject that already has a cheat sheet**

Verify the page now shows the chat panel below the sheet. The textarea should be enabled.

- [ ] **Step 9.3: Send a Q&A message**

Type: `Explain the most important concept on this sheet in two sentences.`
Press Enter.

Expected:
- Assistant bubble streams a reply.
- Cheat sheet above does NOT change.
- Page refresh → both your message and the assistant reply are still there.

- [ ] **Step 9.4: Send an edit message**

Type: `Make the whole sheet about 30% shorter.`
Press Enter.

Expected:
- Assistant streams a short confirmation (e.g. "Shortened the sheet.").
- Cheat sheet above replaces with the new shorter version once the stream finishes.
- "Sheet updated above." footer appears under the assistant bubble.
- Page refresh → shorter sheet + both message + confirmation persist.

- [ ] **Step 9.5: Cross-device check**

On a second browser (or incognito session, signed in as the same Clerk user), navigate to the same subject's cheatsheet page.

Expected: same chat transcript + sheet visible.

- [ ] **Step 9.6: Misbehavior probe (optional but recommended)**

Type: `nonsense $$$ &&& 123`
Expected: the model either answers as Q&A or asks for clarification; no error toast, no sheet rewrite.

- [ ] **Step 9.7: Push to main**

Run: `git push origin main`
Expected: Vercel auto-deploy kicks off. After ~1 min, `https://pufferstudy.vercel.app/subjects/<id>/cheatsheet` shows the chat live in production.

Verify production deployment URL with: `vercel ls --scope mstackinmoney-2723s-projects | head -5`

If the canonical alias `pufferstudy.vercel.app` lags behind the new deploy (known gotcha — see `pufferstudy-resume` memory), re-alias:
```bash
vercel alias set https://<new-deploy-url> pufferstudy.vercel.app --scope mstackinmoney-2723s-projects
```

---

## Self-Review

**Spec coverage walkthrough** (each spec section → tasks that implement it):

- "Locked design decisions #1 layout inline" → Task 8 mounts `<CheatsheetChat>` directly below the cheatsheet, inline.
- "Locked design decisions #2 in-place rewrite" → Task 7 fires `onSheetEdit` when `<sheet>` closes; Task 8 swaps `displayedSheet` and PATCHes `cheatsheetMarkdown`.
- "Locked design decisions #3 auto intent detection" → No toggle in UI (Task 7). System prompt instructs the model to decide (Task 5).
- "Locked design decisions #4 cloud-sync per subject" → Task 2 migration, Task 3 type wiring, Task 6 PATCH extension, Task 8 page-level persistence.
- "Locked design decisions #5 no file re-fetch per turn" → Task 5 explicitly skips `getFilesByIds` / `blobUrlToBase64` for `mode === "refine"`.
- "Tag protocol" → Task 4 (parser + tests) + Task 5 (system prompt).
- "Backend `/api/generate` refine branch" → Task 5.
- "DB schema migration" → Task 2 (uses `sql.query()` per the documented gotcha).
- "API extension to PATCH" → Task 6.
- "UI component" → Task 7.
- "Persistence flow per turn" (steps 1–5 in the spec) → Task 7 (optimistic + onTurnComplete) + Task 8 (PATCH after stream done).
- "Edge cases" → Task 7 disables input when sheet is empty; abort controller handles nav-away; parser surfaces error for half-open `<sheet>`.
- "Tests" → Task 1 (vitest) + Task 4 (parser unit tests + history cap test).
- "Dependencies — no new packages" → vitest and tsx are devDependencies for tests + the migrate script; no runtime deps added.
- "Out of scope items" — none introduced by this plan (no live char-by-char sheet streaming, no PDF re-send, no per-chip topic placeholder, etc).
- "Risks" — Gemini context window risk noted in spec; not pre-engineered, matching the spec's intent.

**Placeholder scan:** none — every step has either a concrete command or a complete code block.

**Type consistency:**
- `ChatMessage` shape `{role, content, ts, sheetEdited?}` is defined once in `types.ts` (Task 3.1) and used identically in subjects-db.ts (Task 3.2), cloud-subjects.ts (Task 3.3), API route (Task 6), parser (Task 4), refine client (Task 7.1), and component (Task 7.2).
- `refine()` returns `void` and uses `onDone({replyText, sheetEdited, parserError})` — matches the call in `<CheatsheetChat>` (Task 7.2) and the parser's `.error` property.
- `updateSubject` patch shape `{name?, testLabel?, testDate?, cheatsheetMarkdown?, chatMessages?}` matches across `lib/subjects-db.ts` (Task 3.2), `app/api/subjects/[id]/route.ts` (Task 6), and `lib/cloud-subjects.ts` (Task 3.3).

No issues found.

---

## Execution Handoff

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit for this plan because Tasks 4 (parser), 5 (server), 7 (component) are mostly independent and can be reviewed/refined in isolation.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch with checkpoints between major chunks (e.g. after Task 2, Task 5, Task 8).

Which approach?
