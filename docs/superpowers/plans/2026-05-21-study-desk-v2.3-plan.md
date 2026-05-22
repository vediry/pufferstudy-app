# Study Desk v2.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-grid home page with a two-column workspace ("study desk") that surfaces today's focus, recent activity, an upcoming-tests timeline, and an enhanced subjects grid — and swap the existing Light/Dark/Forest themes for four premium themes (Gold Atelier default, Platinum Cloud, Space Grey, Midnight Library) with a header dropdown switcher.

**Architecture:** Layout C — left rail (`flex-[1]`, sticky) holds Today + Activity; right column (`flex-[2]`) holds Timeline + Subjects grid. Theme system swaps from class-based `next-themes` to attribute-based (`data-theme` on `<html>`) so per-theme CSS variables resolve via `[data-theme="x"]` selectors. New `activity_log` table records cheatsheet/chat/upload/create events written fire-and-forget from the existing API routes and read via a new `GET /api/activity`. `GET /api/subjects` extended with a `fileCount` JOIN so cards show real numbers. Subjects gain an `archived BOOLEAN` column with PATCH-based archive/unarchive.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind v4, `@vercel/postgres` (Neon), Clerk auth, vitest + tsx, Manrope + Instrument Serif via `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-05-21-study-desk-v2.3-design.md`

**Prerequisite:** v2.2 should be merged/deployed first so the cheatsheet route stays stable while v2.3 changes the home page and shared shell.

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `scripts/migrate-v2.3.ts` | One-off `sql.query()` migrations: create `activity_log` + index, add `archived` column to `subjects` |
| `lib/themes.ts` | Pure data — the 4 themes as `{ name, mode, css: Record<string, string> }` arrays of CSS variable maps |
| `lib/themes.test.ts` | Snapshot test that every theme defines every required variable |
| `lib/activity.ts` | Server-side `logActivity(event)` fire-and-forget helper + the `ActivityEvent` shared type |
| `lib/desk.ts` | Pure helpers used by `subjects-grid` and `today-panel`: `sortSubjects`, `filterSubjects`, `pickSoonestSubject`, `urgencyTier`, `formatRelativeTime` |
| `lib/desk.test.ts` | Unit tests for everything in `lib/desk.ts` |
| `lib/activity-text.ts` | Pure mapping `(event) => { icon, text }` used by `activity-feed` |
| `lib/activity-text.test.ts` | Unit tests for each event-type rendering |
| `app/api/activity/route.ts` | New: `GET` returns last N events for the current user |
| `app/api/activity/route.test.ts` | API test (limit/sort/scope) |
| `components/app-bar.tsx` | Brand wordmark + theme picker + Clerk UserButton |
| `components/theme-picker.tsx` | Dropdown component listing the 4 themes with active checkmark |
| `components/today-panel.tsx` | Renders the soonest-test subject; empty state otherwise |
| `components/activity-feed.tsx` | Fetches `/api/activity`, renders the list |
| `components/upcoming-timeline.tsx` | Horizontal timeline of test dates over next 21 days |
| `components/subjects-grid.tsx` | Hosts search input, sort dropdown, the grid itself, and the archived-toggle section |

**Files modified:**

| File | Change |
|---|---|
| `package.json` | Add `migrate:v23` script |
| `app/layout.tsx` | Replace `next-themes` ThemeProvider with custom; load Manrope + Instrument Serif via `next/font/google`; swap `<Header>` for `<AppBar>` |
| `app/globals.css` | Replace `.dark` / `.forest` blocks with `[data-theme="atelier"]` / `"platinum"` / `"spacegrey"` / `"midnight"` blocks; update font variables; bump body font-weight to 500 |
| `app/page.tsx` | Full rewrite as Layout C composing the four modules |
| `components/theme-provider.tsx` | Replace next-themes wrapper with custom (localStorage + Clerk publicMetadata + migration + inline anti-flash script) |
| `components/clerk-themed-provider.tsx` | Switch from `useTheme()` (next-themes) to the new `useDeskTheme()` hook; update accent colors per theme |
| `components/subject-card.tsx` | Read `subject.fileCount` (not the prop); add hover quick-actions row; use Instrument Serif for subject name |
| `lib/subjects-db.ts` | Extend `DbSubject` with `archived`; `listSubjects` LEFT JOINs `files` and selects `COUNT(*) AS file_count`; `updateSubject` accepts `archived` |
| `lib/cloud-subjects.ts` | Add `archived` + `fileCount` to `Subject`; map both ways; add `archiveSubject(id, archived)` helper |
| `app/api/subjects/[id]/route.ts` | PATCH accepts `archived: boolean` |
| `app/api/generate/route.ts` | Call `logActivity({ type: "cheatsheet_generated", … })` on successful cheatsheet generation |
| `app/api/subjects/route.ts` | Call `logActivity({ type: "subject_created", … })` on POST success |
| `app/api/subjects/[id]/files/route.ts` | Call `logActivity({ type: "files_uploaded", … })` on POST success |

**Deleted:**

| File | Reason |
|---|---|
| `components/theme-toggle.tsx` | Replaced by `theme-picker.tsx`; no longer used anywhere after `header.tsx` is removed |
| `components/header.tsx` | Replaced by `app-bar.tsx` |

---

## Phase A — Backend

## Task 1: DB migration (activity_log + archived column)

**Files:**
- Create: `scripts/migrate-v2.3.ts`
- Modify: `package.json`

- [ ] **Step 1.1: Write the migration script**

Create `scripts/migrate-v2.3.ts`:

```ts
import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running v2.3 migrations…");

  // activity_log — must use sql.query() (tagged template silently swallows DDL).
  await sql.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id            BIGSERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      subject_id    TEXT,
      event_type    TEXT NOT NULL,
      event_data    JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ activity_log table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS activity_log_user_recent_idx
    ON activity_log (user_id, created_at DESC)
  `);
  console.log("✓ activity_log index");

  // archived flag on subjects (idempotent — IF NOT EXISTS).
  await sql.query(`
    ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ subjects.archived column");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 1.2: Add `migrate:v23` script to `package.json`**

In `package.json`, add this script line to the `"scripts"` block (after the existing `"migrate:chat"` line):

```json
"migrate:v23": "node --env-file=.env.local --import tsx scripts/migrate-v2.3.ts"
```

- [ ] **Step 1.3: Run the migration against Neon**

Per the v2.1 gotcha (`vercel env pull` returns empty strings for `POSTGRES_URL` sensitive vars), copy the real `POSTGRES_URL` from the Neon dashboard (console.neon.tech → neon-copper-lens → Connection string) into `.env.local`, then run:

```bash
npm run migrate:v23
```

Expected output:
```
Running v2.3 migrations…
✓ activity_log table
✓ activity_log index
✓ subjects.archived column
Done.
```

If you can't get `POSTGRES_URL` locally, run the same three SQL statements in the Neon SQL Editor in browser (per the v2.1 gotcha). The `IF NOT EXISTS` guards make the migration idempotent — running both is safe.

- [ ] **Step 1.4: Verify in Neon**

In the Neon SQL Editor, run:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'subjects';
SELECT * FROM activity_log LIMIT 1;
```

Expected: `archived` appears in the columns list. `activity_log` query returns zero rows but does NOT error (table exists, just empty).

- [ ] **Step 1.5: Commit**

```bash
git add scripts/migrate-v2.3.ts package.json
git commit -m "feat(db): v2.3 migration — activity_log table + subjects.archived column"
```

---

## Task 2: Extend `DbSubject` + `listSubjects` with `archived` and `fileCount`

**Files:**
- Modify: `lib/subjects-db.ts`

- [ ] **Step 2.1: Add `archived` to `DbSubject` type**

In `lib/subjects-db.ts`, modify the `DbSubject` type (currently lines 5–16) to add `archived: boolean`:

```ts
export type DbSubject = {
  id: string;
  user_id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  chat_messages: ChatMessage[];
  archived: boolean;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2.2: Add a `DbSubjectWithFileCount` type**

Just below `DbSubject`, add:

```ts
export type DbSubjectWithFileCount = DbSubject & { file_count: number };
```

- [ ] **Step 2.3: Update `listSubjects` to JOIN files and select count**

Replace the existing `listSubjects` (currently lines 32–37) with:

```ts
export async function listSubjects(userId: string): Promise<DbSubjectWithFileCount[]> {
  const { rows } = await sql<DbSubjectWithFileCount>`
    SELECT
      s.id, s.user_id, s.name, s.test_label, s.test_date,
      s.cheatsheet_markdown, s.cheatsheet_generated_at,
      s.chat_messages, s.archived, s.created_at, s.updated_at,
      COALESCE(COUNT(f.id), 0)::int AS file_count
    FROM subjects s
    LEFT JOIN files f ON f.subject_id = s.id
    WHERE s.user_id = ${userId}
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `;
  return rows;
}
```

Note the explicit column list — `SELECT *` would not project `file_count` cleanly with the GROUP BY.

- [ ] **Step 2.4: Update `updateSubject` patch type and SQL to accept `archived`**

Modify the `updateSubject` function signature (currently around lines 72–82). Add `archived?: boolean` to the `patch` parameter type:

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
    archived?: boolean;
  },
): Promise<DbSubject | null> {
```

Update the `noFields` check to also include `archived`:

```ts
  const noFields =
    patch.name === undefined &&
    patch.testLabel === undefined &&
    patch.testDate === undefined &&
    patch.cheatsheetMarkdown === undefined &&
    patch.chatMessages === undefined &&
    patch.archived === undefined;
```

Update the UPDATE SQL — add the `archived` line right before `updated_at = now()`:

```ts
  const { rows } = await sql<DbSubject>`
    UPDATE subjects
    SET
      name = COALESCE(${patch.name ?? null}, name),
      test_label = CASE WHEN ${patch.testLabel === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testLabel ?? null} ELSE test_label END,
      test_date = CASE WHEN ${patch.testDate === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testDate ?? null}::date ELSE test_date END,
      cheatsheet_markdown = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.cheatsheetMarkdown ?? null} ELSE cheatsheet_markdown END,
      cheatsheet_generated_at = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${cheatsheetTimestamp}::timestamptz ELSE cheatsheet_generated_at END,
      chat_messages = CASE WHEN ${patch.chatMessages === undefined ? "no" : "yes"}::text = 'yes' THEN ${chatJson}::jsonb ELSE chat_messages END,
      archived = CASE WHEN ${patch.archived === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.archived ?? false}::boolean ELSE archived END,
      updated_at = now()
    WHERE id = ${subjectId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}
```

- [ ] **Step 2.5: Update `getSubjectWithFiles` to type-include `archived`**

The existing `getSubjectWithFiles` returns `DbSubject & { files: DbFile[] }`. Since `DbSubject` now includes `archived`, this is automatically updated. No code change needed but verify by running:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.6: Commit**

```bash
git add lib/subjects-db.ts
git commit -m "feat(db): list subjects with file_count and archived; updateSubject accepts archived"
```

---

## Task 3: Extend client `Subject` type + add `archiveSubject` helper

**Files:**
- Modify: `lib/cloud-subjects.ts`

- [ ] **Step 3.1: Add `archived` and `fileCount` to client `Subject` type**

In `lib/cloud-subjects.ts`, update the `Subject` type (currently lines 6–16):

```ts
export type Subject = {
  id: string;
  name: string;
  testLabel: string | null;
  testDate: string | null;
  cheatsheetMarkdown: string | null;
  cheatsheetGeneratedAt: string | null;
  chatMessages: ChatMessage[];
  archived: boolean;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 3.2: Extend the local `DbSubject` shape**

Just below `SubjectWithFiles`, the file has a local `DbSubject` (lines 30–40). Add `archived: boolean` and `file_count?: number`:

```ts
type DbSubject = {
  id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  chat_messages: ChatMessage[];
  archived: boolean;
  file_count?: number;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3.3: Update `mapSubject` to map the new fields**

Replace the existing `mapSubject` function (currently lines 52–64) with:

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
    archived: row.archived ?? false,
    fileCount: row.file_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

- [ ] **Step 3.4: Add `archived` to the `updateSubject` patch type**

Modify the `updateSubject` client function (around lines 111–129) to accept `archived`:

```ts
export async function updateSubject(
  id: string,
  patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
    archived?: boolean;
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

- [ ] **Step 3.5: Add `archiveSubject` convenience helper**

After the existing `updateSubject` function, add:

```ts
export async function archiveSubject(id: string, archived: boolean): Promise<Subject> {
  return updateSubject(id, { archived });
}
```

- [ ] **Step 3.6: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3.7: Commit**

```bash
git add lib/cloud-subjects.ts
git commit -m "feat(client): Subject gains archived + fileCount; add archiveSubject helper"
```

---

## Task 4: PATCH `/api/subjects/[id]` accepts `archived`

**Files:**
- Modify: `app/api/subjects/[id]/route.ts`

- [ ] **Step 4.1: Read the existing PATCH handler**

Open `app/api/subjects/[id]/route.ts`. The PATCH handler currently destructures specific fields from the body for safety (does not blindly forward to `updateSubject`). Find the destructuring + validation block — it will look like:

```ts
const { name, testLabel, testDate, cheatsheetMarkdown, chatMessages } = body as {
  name?: string;
  testLabel?: string | null;
  testDate?: string | null;
  cheatsheetMarkdown?: string | null;
  chatMessages?: ChatMessage[];
};
```

(The file is the v2.1 PATCH handler; locate by searching for `chatMessages` if line numbers have shifted.)

- [ ] **Step 4.2: Add `archived` to the destructuring + validation**

Replace the destructuring block with:

```ts
const { name, testLabel, testDate, cheatsheetMarkdown, chatMessages, archived } = body as {
  name?: string;
  testLabel?: string | null;
  testDate?: string | null;
  cheatsheetMarkdown?: string | null;
  chatMessages?: ChatMessage[];
  archived?: boolean;
};

if (archived !== undefined && typeof archived !== "boolean") {
  return NextResponse.json({ error: "archived_must_be_boolean" }, { status: 400 });
}
```

Then add `archived` to the patch object passed to `updateSubject` (it's the `await updateSubject(userId, id, { … })` call):

```ts
const updated = await updateSubject(userId, id, {
  name,
  testLabel,
  testDate,
  cheatsheetMarkdown,
  chatMessages,
  archived,
});
```

- [ ] **Step 4.3: Smoke-test with curl (or browser DevTools)**

Start the dev server (`npm run dev`) and from another terminal — using an existing subject ID and a Clerk session cookie if you have one handy — verify the endpoint accepts `archived`:

```bash
curl -X PATCH http://localhost:3000/api/subjects/<some-id> \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-clerk-session-cookie>" \
  -d '{"archived":true}'
```

Expected: `{"subject":{… "archived": true …}}`. If you don't have a cookie handy, defer this verification to the Manual E2E in Task 19. Stop the dev server.

- [ ] **Step 4.4: Commit**

```bash
git add app/api/subjects/[id]/route.ts
git commit -m "feat(api): PATCH /api/subjects/[id] accepts archived boolean"
```

---

## Task 5: `logActivity` helper + wire into 4 endpoints

**Files:**
- Create: `lib/activity.ts`
- Create: `lib/activity.test.ts`
- Modify: `app/api/generate/route.ts`
- Modify: `app/api/subjects/route.ts`
- Modify: `app/api/subjects/[id]/route.ts`
- Modify: `app/api/subjects/[id]/files/route.ts`

- [ ] **Step 5.1: Write the failing test for `logActivity` shape**

Create `lib/activity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @vercel/postgres so the test runs in node env without a DB.
vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(async () => ({ rows: [] })),
}));

import { sql } from "@vercel/postgres";
import { logActivity } from "@/lib/activity";

describe("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a row with userId, subjectId, type, and data", async () => {
    await logActivity({
      userId: "user_abc",
      subjectId: "subj_1",
      type: "cheatsheet_generated",
      data: { sourceFileCount: 3 },
    });
    expect(sql).toHaveBeenCalledTimes(1);
    // The tagged template arrives as a TemplateStringsArray + interpolations.
    // We only assert that the four values appear in the call args.
    const callArgs = (sql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const interpolations = callArgs.slice(1);
    expect(interpolations).toEqual([
      "user_abc",
      "subj_1",
      "cheatsheet_generated",
      JSON.stringify({ sourceFileCount: 3 }),
    ]);
  });

  it("accepts a null subjectId for user-level events", async () => {
    await logActivity({
      userId: "user_abc",
      subjectId: null,
      type: "subject_created",
      data: { name: "Biology" },
    });
    const callArgs = (sql as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const interpolations = callArgs.slice(1);
    expect(interpolations[1]).toBeNull();
  });

  it("swallows DB errors (fire-and-forget)", async () => {
    (sql as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down"));
    // Should NOT throw.
    await expect(
      logActivity({
        userId: "u",
        subjectId: "s",
        type: "cheatsheet_generated",
        data: {},
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 5.2: Run the test — expect failure**

```bash
npm test -- lib/activity.test.ts
```

Expected: failure because `lib/activity.ts` doesn't exist yet.

- [ ] **Step 5.3: Implement `lib/activity.ts`**

Create `lib/activity.ts`:

```ts
import "server-only";
import { sql } from "@vercel/postgres";

export type ActivityEventType =
  | "cheatsheet_generated"
  | "cheatsheet_refined"
  | "chat_question"
  | "files_uploaded"
  | "subject_created";

export type ActivityEvent = {
  id: number;
  subjectId: string | null;
  subjectName: string | null;
  type: ActivityEventType;
  data: Record<string, unknown>;
  createdAt: string;
};

type LogInput = {
  userId: string;
  subjectId: string | null;
  type: ActivityEventType;
  data: Record<string, unknown>;
};

/**
 * Fire-and-forget. Records a row in activity_log. A DB failure logs to
 * console and returns — never throws into the calling endpoint.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await sql`
      INSERT INTO activity_log (user_id, subject_id, event_type, event_data)
      VALUES (${input.userId}, ${input.subjectId}, ${input.type}, ${JSON.stringify(input.data)}::jsonb)
    `;
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export async function listActivity(userId: string, limit: number): Promise<ActivityEvent[]> {
  const safeLimit = Math.max(1, Math.min(100, limit | 0));
  const { rows } = await sql<{
    id: number;
    subject_id: string | null;
    event_type: ActivityEventType;
    event_data: Record<string, unknown>;
    created_at: string;
    subject_name: string | null;
  }>`
    SELECT
      a.id,
      a.subject_id,
      a.event_type,
      a.event_data,
      a.created_at,
      s.name AS subject_name
    FROM activity_log a
    LEFT JOIN subjects s ON s.id = a.subject_id
    WHERE a.user_id = ${userId}
    ORDER BY a.created_at DESC
    LIMIT ${safeLimit}
  `;
  return rows.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    type: r.event_type,
    data: r.event_data ?? {},
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 5.4: Run the test — expect pass**

```bash
npm test -- lib/activity.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5.5: Wire into `POST /api/subjects` (subject_created)**

In `app/api/subjects/route.ts`, after the successful `createSubject(…)` call (inside the `try`, before `return NextResponse.json(...)`), add the activity log:

```ts
try {
  const subject = await createSubject(userId, {
    name,
    testLabel: body.testLabel?.toString().trim() || null,
    testDate: body.testDate?.toString().trim() || null,
  });
  // Fire-and-forget activity log.
  void logActivity({
    userId,
    subjectId: subject.id,
    type: "subject_created",
    data: { name: subject.name },
  });
  return NextResponse.json({ subject });
} catch (err) {
  …
}
```

Add the import at the top of the file:

```ts
import { logActivity } from "@/lib/activity";
```

- [ ] **Step 5.6: Wire into `POST /api/generate` (cheatsheet_generated)**

Open `app/api/generate/route.ts`. The `cheatsheet` mode branch streams output and the client (`generate` in `lib/gemini-client.ts`) handles `onDone` client-side — the server has no `onDone` hook. Instead, log when the request is accepted and processing begins for the cheatsheet mode.

Find the section that determines the mode (likely an early `if (mode === "cheatsheet")` branch). Right after `userId` is resolved and before the Gemini streaming starts, add:

```ts
if (mode === "cheatsheet") {
  void logActivity({
    userId,
    subjectId: subjectId ?? null,
    type: "cheatsheet_generated",
    data: { sourceFileCount: fileIds?.length ?? 0 },
  });
}
```

Add the import at the top:

```ts
import { logActivity } from "@/lib/activity";
```

If the route doesn't currently destructure `subjectId` from the request body, add it to the body type:

```ts
const { apiKey, mode, subjectName, subjectId, fileIds, … } = body as {
  apiKey: string;
  mode: GenerateMode;
  subjectName: string;
  subjectId?: string;        // optional — present for cheatsheet/refine modes
  fileIds?: string[];
  …
};
```

This pairs with a tiny client change in Task 14 to start sending `subjectId` from the cheatsheet page.

- [ ] **Step 5.7: Wire into `PATCH /api/subjects/[id]` (chat_question / cheatsheet_refined)**

In `app/api/subjects/[id]/route.ts`, after the `updateSubject(…)` call returns successfully and before the response, log activity if `chatMessages` was patched. The last assistant message determines whether it was a Q&A or an edit (via the `sheetEdited` flag on the message).

Add after the `const updated = await updateSubject(…)` line:

```ts
if (chatMessages && chatMessages.length > 0 && updated) {
  const last = chatMessages[chatMessages.length - 1];
  const userMsg = chatMessages
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  if (last.role === "assistant" && userMsg) {
    const topic = userMsg.content.split(/\s+/).slice(0, 6).join(" ");
    if (last.sheetEdited) {
      void logActivity({
        userId,
        subjectId: updated.id,
        type: "cheatsheet_refined",
        data: { topic },
      });
    } else {
      void logActivity({
        userId,
        subjectId: updated.id,
        type: "chat_question",
        data: { topic },
      });
    }
  }
}
```

Add the import:

```ts
import { logActivity } from "@/lib/activity";
```

- [ ] **Step 5.8: Wire into `POST /api/subjects/[id]/files` (files_uploaded)**

In `app/api/subjects/[id]/files/route.ts`, after the successful file insert and before the JSON response, log activity:

```ts
void logActivity({
  userId,
  subjectId,
  type: "files_uploaded",
  data: { count: 1, mimeType: file.type },
});
```

Add the import:

```ts
import { logActivity } from "@/lib/activity";
```

Note: each upload is a single file in this route, so `count: 1` is correct per call. The UI groups consecutive uploads visually if needed.

- [ ] **Step 5.9: Run typecheck and tests**

```bash
npm run typecheck && npm test
```

Expected: green.

- [ ] **Step 5.10: Commit**

```bash
git add lib/activity.ts lib/activity.test.ts app/api/generate/route.ts app/api/subjects/route.ts app/api/subjects/[id]/route.ts app/api/subjects/[id]/files/route.ts
git commit -m "feat(activity): logActivity helper wired into generate/create/patch/upload"
```

---

## Task 6: `GET /api/activity` endpoint

**Files:**
- Create: `app/api/activity/route.ts`
- Create: `app/api/activity/route.test.ts`

- [ ] **Step 6.1: Write the failing API test**

Create `app/api/activity/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListActivity = vi.fn();
vi.mock("@/lib/activity", () => ({
  listActivity: mockListActivity,
}));

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

import { GET } from "@/app/api/activity/route";

describe("GET /api/activity", () => {
  beforeEach(() => {
    mockListActivity.mockReset();
    mockAuth.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = new Request("http://localhost/api/activity");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns events for the current user with default limit", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    const sampleEvents = [
      { id: 1, subjectId: "s1", subjectName: "Bio", type: "cheatsheet_generated", data: {}, createdAt: "2026-05-21T00:00:00.000Z" },
    ];
    mockListActivity.mockResolvedValue(sampleEvents);
    const req = new Request("http://localhost/api/activity");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ events: sampleEvents });
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 10);
  });

  it("respects ?limit query parameter and clamps it", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    mockListActivity.mockResolvedValue([]);
    const req = new Request("http://localhost/api/activity?limit=25");
    await GET(req);
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 25);
  });

  it("falls back to 10 when limit is not a positive integer", async () => {
    mockAuth.mockResolvedValue({ userId: "user_abc" });
    mockListActivity.mockResolvedValue([]);
    const req = new Request("http://localhost/api/activity?limit=garbage");
    await GET(req);
    expect(mockListActivity).toHaveBeenCalledWith("user_abc", 10);
  });
});
```

- [ ] **Step 6.2: Run the test — expect failure**

```bash
npm test -- app/api/activity/route.test.ts
```

Expected: failure ("route.ts not found" or import error).

The vitest config currently only includes `lib/**/*.test.ts(x)`. Extend the include in `vitest.config.ts`:

```ts
test: {
  environment: "node",
  include: ["lib/**/*.test.ts", "lib/**/*.test.tsx", "app/**/*.test.ts"],
},
```

Rerun the test — now expect the import error for the missing `route.ts`.

- [ ] **Step 6.3: Implement the route**

Create `app/api/activity/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;

  const events = await listActivity(userId, limit);
  return NextResponse.json({ events });
}
```

- [ ] **Step 6.4: Run the test — expect pass**

```bash
npm test -- app/api/activity/route.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add app/api/activity/route.ts app/api/activity/route.test.ts vitest.config.ts
git commit -m "feat(api): GET /api/activity returns recent events for current user"
```

---

## Phase B — Theme system

## Task 7: Install fonts + create `lib/themes.ts` with snapshot test

**Files:**
- Create: `lib/themes.ts`
- Create: `lib/themes.test.ts`
- Modify: `app/layout.tsx` (font imports only; provider swap is Task 13)

- [ ] **Step 7.1: Write the failing theme snapshot test**

Create `lib/themes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { THEMES, REQUIRED_VARS, type ThemeId } from "@/lib/themes";

describe("themes", () => {
  it("defines exactly 4 themes with stable ids", () => {
    const ids = THEMES.map((t) => t.id).sort();
    expect(ids).toEqual<ThemeId[]>(["atelier", "midnight", "platinum", "spacegrey"]);
  });

  it("every theme defines every required CSS variable", () => {
    for (const theme of THEMES) {
      for (const v of REQUIRED_VARS) {
        expect(theme.css[v], `${theme.id} missing ${v}`).toBeTruthy();
      }
    }
  });

  it("light/dark mode is set correctly per theme", () => {
    const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
    expect(byId.atelier.mode).toBe("light");
    expect(byId.platinum.mode).toBe("light");
    expect(byId.spacegrey.mode).toBe("dark");
    expect(byId.midnight.mode).toBe("dark");
  });
});
```

- [ ] **Step 7.2: Run — expect failure**

```bash
npm test -- lib/themes.test.ts
```

Expected: import error.

- [ ] **Step 7.3: Implement `lib/themes.ts`**

Create `lib/themes.ts`:

```ts
export type ThemeId = "atelier" | "platinum" | "spacegrey" | "midnight";
export type ThemeMode = "light" | "dark";

export type Theme = {
  id: ThemeId;
  name: string;
  mode: ThemeMode;
  swatch: string;        // for the theme-picker dot
  css: Record<string, string>;
};

/**
 * Variables every theme must define. Keep alphabetized.
 * Add a variable here only if it's used cross-component; one-off
 * gradient stops can be inlined where they're used.
 */
export const REQUIRED_VARS = [
  "--accent",
  "--accent-deep",
  "--accent-light",
  "--bg",
  "--bg-grad-bottom",
  "--bg-grad-top",
  "--border",
  "--border-strong",
  "--danger",
  "--ink",
  "--ink-faint",
  "--ink-muted",
  "--primary",
  "--primary-foreground",
  "--surface",
  "--surface-2",
  "--surface-3",
  "--warn",
] as const;

export const THEMES: Theme[] = [
  {
    id: "atelier",
    name: "Gold Atelier",
    mode: "light",
    swatch: "linear-gradient(135deg, #d4b06e, #b08842)",
    css: {
      "--bg": "#faf6ec",
      "--bg-grad-top": "#faf6ec",
      "--bg-grad-bottom": "#f3ecd9",
      "--surface": "#fffaef",
      "--surface-2": "#f5edd6",
      "--surface-3": "#ece1c0",
      "--border": "#d8c89c",
      "--border-strong": "#c9a96e",
      "--ink": "#2c241a",
      "--ink-muted": "#6b5d44",
      "--ink-faint": "#9c8d70",
      "--accent": "#b08842",
      "--accent-light": "#d4b06e",
      "--accent-deep": "#8c6a30",
      "--primary": "#b08842",
      "--primary-foreground": "#fffaef",
      "--warn": "#a8531e",
      "--danger": "#8c2a1f",
    },
  },
  {
    id: "platinum",
    name: "Platinum Cloud",
    mode: "light",
    swatch: "linear-gradient(135deg, #e0e4e9, #8a9099)",
    css: {
      "--bg": "#fafbfc",
      "--bg-grad-top": "#fafbfc",
      "--bg-grad-bottom": "#eceff3",
      "--surface": "#ffffff",
      "--surface-2": "#f1f3f5",
      "--surface-3": "#e0e4e9",
      "--border": "#d1d5db",
      "--border-strong": "#9ca3af",
      "--ink": "#1d242c",
      "--ink-muted": "#4b5563",
      "--ink-faint": "#6b7480",
      "--accent": "#4a5159",
      "--accent-light": "#9ca3af",
      "--accent-deep": "#2a2f37",
      "--primary": "#2a2f37",
      "--primary-foreground": "#fafbfc",
      "--warn": "#b45309",
      "--danger": "#991b1b",
    },
  },
  {
    id: "spacegrey",
    name: "Space Grey",
    mode: "dark",
    swatch: "linear-gradient(135deg, #383631, #1c1b18)",
    css: {
      "--bg": "#1c1b18",
      "--bg-grad-top": "#2a2926",
      "--bg-grad-bottom": "#1c1b18",
      "--surface": "#2f2d29",
      "--surface-2": "#3a3833",
      "--surface-3": "#4a473f",
      "--border": "rgba(255,255,255,0.08)",
      "--border-strong": "rgba(255,255,255,0.18)",
      "--ink": "#ece6d7",
      "--ink-muted": "#bab2a0",
      "--ink-faint": "#8a8478",
      "--accent": "#c9a96e",
      "--accent-light": "#d4b78a",
      "--accent-deep": "#a8884c",
      "--primary": "#c9a96e",
      "--primary-foreground": "#1c1b18",
      "--warn": "#e89940",
      "--danger": "#ff9d8e",
    },
  },
  {
    id: "midnight",
    name: "Midnight Library",
    mode: "dark",
    swatch: "linear-gradient(135deg, #161e30, #060912)",
    css: {
      "--bg": "#0e1320",
      "--bg-grad-top": "#0e1320",
      "--bg-grad-bottom": "#060912",
      "--surface": "#161e30",
      "--surface-2": "#1b2538",
      "--surface-3": "#243049",
      "--border": "rgba(212,183,138,0.12)",
      "--border-strong": "rgba(212,183,138,0.3)",
      "--ink": "#ece1c8",
      "--ink-muted": "#bdb39a",
      "--ink-faint": "#8a8a82",
      "--accent": "#d4b78a",
      "--accent-light": "#e6cba0",
      "--accent-deep": "#a89060",
      "--primary": "#d4b78a",
      "--primary-foreground": "#0e1320",
      "--warn": "#e89940",
      "--danger": "#ff9d8e",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "atelier";
export const STORAGE_KEY = "pufferstudy.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return value === "atelier" || value === "platinum" || value === "spacegrey" || value === "midnight";
}

/**
 * Migrate legacy v2.0–v2.2 theme ids to v2.3 ids.
 * Light → atelier, Dark → spacegrey, Forest → atelier (forest's warmth maps
 * cleanest to gold over moss green).
 */
export function migrateLegacyTheme(legacy: string | null): ThemeId | null {
  if (legacy === "light") return "atelier";
  if (legacy === "dark") return "spacegrey";
  if (legacy === "forest") return "atelier";
  if (isThemeId(legacy)) return legacy;
  return null;
}
```

- [ ] **Step 7.4: Add tests for `isThemeId` and `migrateLegacyTheme`**

Append to `lib/themes.test.ts`:

```ts
import { isThemeId, migrateLegacyTheme } from "@/lib/themes";

describe("isThemeId", () => {
  it("accepts the 4 known ids", () => {
    expect(isThemeId("atelier")).toBe(true);
    expect(isThemeId("platinum")).toBe(true);
    expect(isThemeId("spacegrey")).toBe(true);
    expect(isThemeId("midnight")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isThemeId("light")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
    expect(isThemeId(123)).toBe(false);
  });
});

describe("migrateLegacyTheme", () => {
  it("maps light → atelier", () => expect(migrateLegacyTheme("light")).toBe("atelier"));
  it("maps dark → spacegrey", () => expect(migrateLegacyTheme("dark")).toBe("spacegrey"));
  it("maps forest → atelier", () => expect(migrateLegacyTheme("forest")).toBe("atelier"));
  it("passes through valid v2.3 ids", () => {
    expect(migrateLegacyTheme("platinum")).toBe("platinum");
    expect(migrateLegacyTheme("midnight")).toBe("midnight");
  });
  it("returns null for unknown values", () => {
    expect(migrateLegacyTheme(null)).toBe(null);
    expect(migrateLegacyTheme("hot-pink")).toBe(null);
  });
});
```

- [ ] **Step 7.5: Run all theme tests — expect pass**

```bash
npm test -- lib/themes.test.ts
```

Expected: all tests pass.

- [ ] **Step 7.6: Add Manrope + Instrument Serif via `next/font`**

In `app/layout.tsx`, replace the existing `Spline_Sans`, `Spline_Sans_Mono` imports/usages with Manrope + Instrument Serif. Update the top of the file:

```ts
import type { Metadata, Viewport } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import { ClerkThemedProvider } from "@/components/clerk-themed-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AppBar } from "@/components/app-bar";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],  // skip 400 — too thin (see spec typography rules)
  variable: "--font-manrope",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});
```

And update the `<html>` tag's className:

```tsx
<html
  lang="en"
  suppressHydrationWarning
  className={`${manrope.variable} ${instrumentSerif.variable}`}
>
```

Don't worry about `<AppBar>` / `<Header>` swap yet — that's Task 13. For this commit, leave `<Header />` in place even though it'll get replaced.

Actually, since `Header` is going away in Task 13, you might get a TypeScript error if you remove the Spline imports while Spline is still referenced elsewhere. Run typecheck after this step to catch anything; if you see errors, leave the old Spline imports in alongside the new Manrope ones, and finish removing them in Task 13.

```bash
npm run typecheck
```

- [ ] **Step 7.7: Commit**

```bash
git add lib/themes.ts lib/themes.test.ts app/layout.tsx
git commit -m "feat(themes): four-theme data with snapshot test; load Manrope + Instrument Serif"
```

---

## Task 8: Replace `app/globals.css` theme blocks

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 8.1: Replace the `--font-sans` line in `@theme`**

In `app/globals.css`, find the `@theme { ... }` block (around lines 5–25). Replace these two lines:

```css
--font-sans: var(--font-spline-sans), ui-sans-serif, system-ui, sans-serif;
--font-mono: var(--font-spline-sans-mono), ui-monospace, "SF Mono", Menlo, monospace;
```

with:

```css
--font-sans: var(--font-manrope), ui-sans-serif, system-ui, sans-serif;
--font-serif: var(--font-instrument-serif), ui-serif, Georgia, serif;
--font-mono: ui-monospace, "SF Mono", Menlo, monospace;
```

(Mono is kept as a system fallback — no remaining usage needs the v2.0 mono font.)

- [ ] **Step 8.2: Replace `:root`, `.dark`, and `.forest` blocks with `[data-theme="..."]` blocks**

The current `@layer base { :root { ... } .dark { ... } .forest { ... } }` block (lines 27–102) holds the legacy themes. Replace the entire `:root { … } .dark { … } .forest { … }` content with attribute-selector blocks. All 4 themes share variables — only values differ. Use this structure:

```css
@layer base {
  /* Default theme = Gold Atelier (matches lib/themes.ts) */
  :root,
  [data-theme="atelier"] {
    --bg: #faf6ec;
    --bg-grad-top: #faf6ec;
    --bg-grad-bottom: #f3ecd9;
    --surface: #fffaef;
    --surface-2: #f5edd6;
    --surface-3: #ece1c0;
    --border: #d8c89c;
    --border-strong: #c9a96e;
    --ink: #2c241a;
    --ink-muted: #6b5d44;
    --ink-faint: #9c8d70;
    --accent: #b08842;
    --accent-light: #d4b06e;
    --accent-deep: #8c6a30;
    --primary: #b08842;
    --primary-hover: #d4b06e;
    --primary-active: #8c6a30;
    --primary-foreground: #fffaef;
    --ring: rgba(176, 136, 66, 0.4);
    --success: #3B8C4F;
    --warning: #a8531e;
    --danger: #8c2a1f;
    --info: #3578C9;
    --shadow-sm: 0 1px 2px rgba(140, 106, 48, 0.08);
    --shadow: 0 4px 12px rgba(140, 106, 48, 0.10), 0 1px 3px rgba(140, 106, 48, 0.06);
    --shadow-lg: 0 12px 32px rgba(140, 106, 48, 0.14), 0 4px 8px rgba(140, 106, 48, 0.08);
  }

  [data-theme="platinum"] {
    --bg: #fafbfc;
    --bg-grad-top: #fafbfc;
    --bg-grad-bottom: #eceff3;
    --surface: #ffffff;
    --surface-2: #f1f3f5;
    --surface-3: #e0e4e9;
    --border: #d1d5db;
    --border-strong: #9ca3af;
    --ink: #1d242c;
    --ink-muted: #4b5563;
    --ink-faint: #6b7480;
    --accent: #4a5159;
    --accent-light: #9ca3af;
    --accent-deep: #2a2f37;
    --primary: #2a2f37;
    --primary-hover: #4a5159;
    --primary-active: #1d242c;
    --primary-foreground: #fafbfc;
    --ring: rgba(74, 81, 89, 0.4);
    --success: #047857;
    --warning: #b45309;
    --danger: #991b1b;
    --info: #1e40af;
    --shadow-sm: 0 1px 2px rgba(29, 36, 44, 0.05);
    --shadow: 0 4px 12px rgba(29, 36, 44, 0.08), 0 1px 3px rgba(29, 36, 44, 0.04);
    --shadow-lg: 0 12px 32px rgba(29, 36, 44, 0.12), 0 4px 8px rgba(29, 36, 44, 0.06);
  }

  [data-theme="spacegrey"] {
    --bg: #1c1b18;
    --bg-grad-top: #2a2926;
    --bg-grad-bottom: #1c1b18;
    --surface: #2f2d29;
    --surface-2: #3a3833;
    --surface-3: #4a473f;
    --border: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.18);
    --ink: #ece6d7;
    --ink-muted: #bab2a0;
    --ink-faint: #8a8478;
    --accent: #c9a96e;
    --accent-light: #d4b78a;
    --accent-deep: #a8884c;
    --primary: #c9a96e;
    --primary-hover: #d4b78a;
    --primary-active: #a8884c;
    --primary-foreground: #1c1b18;
    --ring: rgba(201, 169, 110, 0.4);
    --success: #5EBD75;
    --warning: #e89940;
    --danger: #ff9d8e;
    --info: #6BA6E5;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
  }

  [data-theme="midnight"] {
    --bg: #0e1320;
    --bg-grad-top: #0e1320;
    --bg-grad-bottom: #060912;
    --surface: #161e30;
    --surface-2: #1b2538;
    --surface-3: #243049;
    --border: rgba(212, 183, 138, 0.12);
    --border-strong: rgba(212, 183, 138, 0.3);
    --ink: #ece1c8;
    --ink-muted: #bdb39a;
    --ink-faint: #8a8a82;
    --accent: #d4b78a;
    --accent-light: #e6cba0;
    --accent-deep: #a89060;
    --primary: #d4b78a;
    --primary-hover: #e6cba0;
    --primary-active: #a89060;
    --primary-foreground: #0e1320;
    --ring: rgba(212, 183, 138, 0.4);
    --success: #7FD49A;
    --warning: #e89940;
    --danger: #ff9d8e;
    --info: #8FB39B;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.6);
  }

  * {
    border-color: var(--border);
  }

  html, body {
    background:
      radial-gradient(ellipse at top left, rgba(176,136,66,0.06), transparent 60%),
      linear-gradient(180deg, var(--bg-grad-top) 0%, var(--bg-grad-bottom) 100%);
    background-attachment: fixed;
    color: var(--ink);
    font-family: var(--font-sans);
    font-weight: 500;             /* spec typography rule */
    font-size: 16px;              /* spec typography rule */
    line-height: 1.55;
    font-feature-settings: "ss01", "cv11";
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    min-height: 100vh;
    min-height: 100dvh;
  }

  strong { font-weight: 700; }

  /* Numeric values get tabular nums by default */
  .tabular { font-variant-numeric: tabular-nums; }

  /* Focus ring */
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
}
```

Also remove the `@custom-variant dark (&:is(.dark *));` line at the very top — the class-based dark variant is no longer used. (Search for `@custom-variant dark` and delete that line.)

Also remove the `--color-puffer-*` brand block from `@theme` (lines 6–14 in the original file) — puffer orange is no longer the brand color. Leave the `--radius-*` and font variables in `@theme`.

- [ ] **Step 8.3: Verify**

```bash
npm run typecheck
```

The CSS is processed by Tailwind, not TypeScript — typecheck only verifies TS. Run the dev server briefly to confirm the CSS compiles:

```bash
npm run dev
```

Open `http://localhost:3000` — the page will probably look broken (no `data-theme` set yet) but should NOT throw a CSS parse error in the terminal. Stop the dev server.

- [ ] **Step 8.4: Commit**

```bash
git add app/globals.css
git commit -m "feat(themes): replace Light/Dark/Forest CSS blocks with [data-theme] selectors"
```

---

## Task 9: Custom `theme-provider.tsx` with localStorage + migration + anti-flash

**Files:**
- Modify: `components/theme-provider.tsx` (full rewrite)

- [ ] **Step 9.1: Read the existing file to preserve its export shape**

The current `components/theme-provider.tsx` re-exports the next-themes ThemeProvider. We're replacing the entire contents.

- [ ] **Step 9.2: Rewrite as the custom provider**

Overwrite `components/theme-provider.tsx` with:

```tsx
"use client";

import * as React from "react";
import {
  THEMES,
  DEFAULT_THEME,
  STORAGE_KEY,
  isThemeId,
  migrateLegacyTheme,
  type ThemeId,
} from "@/lib/themes";

type ThemeCtx = {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const Ctx = React.createContext<ThemeCtx | null>(null);

/**
 * Inline script that runs BEFORE React hydrates. Reads localStorage,
 * migrates legacy v2.0–v2.2 ids, and sets data-theme on <html>. This
 * prevents the flash of unstyled content where the wrong palette shows
 * briefly on first render.
 *
 * Important: this is a Server Component path — the script tag is
 * rendered into the HTML response. It runs synchronously in the browser
 * before the React tree mounts.
 */
export function ThemeAntiFlashScript() {
  const code = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var legacy = { light: "atelier", dark: "spacegrey", forest: "atelier" };
    var id = legacy[stored] || stored;
    var valid = ["atelier","platinum","spacegrey","midnight"];
    if (valid.indexOf(id) === -1) id = ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.setAttribute("data-theme", id);
    if (id !== stored) localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, id);
  } catch (_) {}
})();
`.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = React.useState<ThemeId>(DEFAULT_THEME);
  const [mounted, setMounted] = React.useState(false);

  // After hydration, sync state with what the anti-flash script already set.
  React.useEffect(() => {
    const raw = document.documentElement.getAttribute("data-theme");
    if (isThemeId(raw)) {
      setThemeIdState(raw);
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      const migrated = migrateLegacyTheme(stored);
      const resolved = migrated ?? DEFAULT_THEME;
      setThemeIdState(resolved);
      document.documentElement.setAttribute("data-theme", resolved);
    }
    setMounted(true);
  }, []);

  const setTheme = React.useCallback((id: ThemeId) => {
    setThemeIdState(id);
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage disabled — proceed without persistence.
    }
    // Fire-and-forget sync to Clerk publicMetadata so other devices follow.
    void fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {
      // Best-effort — ignore network errors.
    });
  }, []);

  const value = React.useMemo(() => ({ themeId, setTheme }), [themeId, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeskTheme(): ThemeCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useDeskTheme must be used inside <ThemeProvider>");
  return ctx;
}

// Re-export THEMES so consumers can map without two imports.
export { THEMES };
```

- [ ] **Step 9.3: Create the `/api/user/theme` PATCH endpoint**

Create `app/api/user/theme/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isThemeId } from "@/lib/themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { theme?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isThemeId(body.theme)) {
    return NextResponse.json({ error: "invalid_theme" }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { theme: body.theme },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9.4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. The new ThemeProvider is named the same as the one being replaced, so consumers (`app/layout.tsx`) don't need import changes yet.

- [ ] **Step 9.5: Commit**

```bash
git add components/theme-provider.tsx app/api/user/theme/route.ts
git commit -m "feat(themes): custom theme provider with anti-flash script + Clerk metadata sync"
```

---

## Task 10: `theme-picker.tsx` dropdown component

**Files:**
- Create: `components/theme-picker.tsx`

- [ ] **Step 10.1: Implement the picker**

Create `components/theme-picker.tsx`:

```tsx
"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { useDeskTheme, THEMES } from "@/components/theme-provider";

export function ThemePicker() {
  const { themeId, setTheme } = useDeskTheme();
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 border border-default bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose theme"
      >
        <span
          className="h-4 w-4 rounded-full border border-default"
          style={{ background: active.swatch }}
          aria-hidden
        />
        <span>{active.name.split(" ")[1] ?? active.name}</span>
        <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] border border-strong bg-surface shadow-lifted"
        >
          <div className="border-b border-default px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={t.id === themeId}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2 ${
                t.id === themeId ? "bg-surface-2 font-semibold" : "font-medium"
              }`}
            >
              <span
                className="h-[18px] w-[18px] rounded-full border border-default"
                style={{ background: t.swatch }}
                aria-hidden
              />
              <span className="flex-1 text-left text-ink">{t.name}</span>
              {t.id === themeId ? (
                <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2.5} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 10.2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 10.3: Commit**

```bash
git add components/theme-picker.tsx
git commit -m "feat(themes): ThemePicker dropdown with active checkmark and swatches"
```

---

## Task 11: Update `ClerkThemedProvider` for new themes

**Files:**
- Modify: `components/clerk-themed-provider.tsx`

- [ ] **Step 11.1: Swap the theme hook + accent map**

Open `components/clerk-themed-provider.tsx`. Replace the existing file contents with:

```tsx
"use client";

import * as React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useDeskTheme, THEMES } from "@/components/theme-provider";

export function ClerkThemedProvider({ children }: { children: React.ReactNode }) {
  const { themeId } = useDeskTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const theme = mounted ? THEMES.find((t) => t.id === themeId) ?? THEMES[0] : THEMES[0];
  const isDark = theme.mode === "dark";

  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          fontFamily: "var(--font-manrope)",
          colorPrimary: theme.css["--accent"],
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
```

- [ ] **Step 11.2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 11.3: Commit**

```bash
git add components/clerk-themed-provider.tsx
git commit -m "feat(themes): wire ClerkThemedProvider to new theme system; use accent as Clerk primary"
```

---

## Phase C — App shell

## Task 12: `AppBar` component

**Files:**
- Create: `components/app-bar.tsx`

- [ ] **Step 12.1: Implement the app bar**

Create `components/app-bar.tsx`:

```tsx
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ThemePicker } from "@/components/theme-picker";

export function AppBar() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-default bg-[color:var(--surface)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/70">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-2 text-ink no-underline">
          <span
            className="font-serif text-[1.4rem] leading-none"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Puffer<span className="italic" style={{ color: "var(--accent-deep)" }}>Study</span>
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <ThemePicker />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
                userButtonPopoverCard: "bg-surface border border-default shadow-lifted",
                userButtonPopoverActionButton: "text-ink hover:bg-surface-2",
                userButtonPopoverActionButtonText: "text-ink",
                userButtonPopoverFooter: "hidden",
              },
            }}
          />
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 12.2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 12.3: Commit**

```bash
git add components/app-bar.tsx
git commit -m "feat(shell): AppBar component with serif wordmark + theme picker + Clerk avatar"
```

---

## Task 13: Swap `Header` → `AppBar` in `app/layout.tsx`; render anti-flash script

**Files:**
- Modify: `app/layout.tsx`
- Delete: `components/header.tsx`
- Delete: `components/theme-toggle.tsx`

- [ ] **Step 13.1: Update `app/layout.tsx`**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata, Viewport } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import { ClerkThemedProvider } from "@/components/clerk-themed-provider";
import { ThemeProvider, ThemeAntiFlashScript } from "@/components/theme-provider";
import { AppBar } from "@/components/app-bar";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PufferStudy — Your study workspace",
  description:
    "Per-subject hub for notes, cheat sheets, chat, assignments, and more.",
  applicationName: "PufferStudy",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="atelier"
      className={`${manrope.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <ThemeAntiFlashScript />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <ClerkThemedProvider>
            <div className="flex min-h-dvh flex-col">
              <AppBar />
              <main className="flex-1">{children}</main>
              <footer className="no-print mt-auto border-t border-default py-6 text-center text-sm text-ink-faint">
                <span className="mx-auto">PufferStudy · Your study workspace.</span>
              </footer>
            </div>
          </ClerkThemedProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

The `data-theme="atelier"` default on `<html>` is what the anti-flash script overrides if localStorage holds a different theme.

- [ ] **Step 13.2: Delete the unused files**

```bash
git rm components/header.tsx components/theme-toggle.tsx
```

If they are still referenced anywhere (unlikely after this swap), the typecheck in the next step will fail. If so, search for `from "@/components/header"` or `from "@/components/theme-toggle"` and remove those imports.

- [ ] **Step 13.3: Run typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: green. If you see an "imported value … was not declared" error from any page, search for the offending import and remove it.

- [ ] **Step 13.4: Smoke-test in dev**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- The new app bar appears at the top with "PufferStudy" wordmark (serif) and the theme picker.
- Click the picker — dropdown appears with 4 themes. Selecting one immediately recolors the page.
- Hard refresh — the chosen theme persists.
- The home page itself is still the old subject grid; we replace it in Task 18.

Stop the dev server.

- [ ] **Step 13.5: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(shell): swap Header → AppBar; render theme anti-flash script; remove next-themes"
```

---

## Phase D — Desk modules

## Task 14: Pure helpers in `lib/desk.ts` with tests

**Files:**
- Create: `lib/desk.ts`
- Create: `lib/desk.test.ts`

- [ ] **Step 14.1: Write the failing tests**

Create `lib/desk.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sortSubjects,
  filterSubjects,
  pickSoonestSubject,
  urgencyTier,
  formatRelativeTime,
  type SortMode,
} from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

function s(overrides: Partial<Subject> = {}): Subject {
  return {
    id: overrides.id ?? "subj_x",
    name: overrides.name ?? "Subject",
    testLabel: overrides.testLabel ?? null,
    testDate: overrides.testDate ?? null,
    cheatsheetMarkdown: overrides.cheatsheetMarkdown ?? null,
    cheatsheetGeneratedAt: overrides.cheatsheetGeneratedAt ?? null,
    chatMessages: overrides.chatMessages ?? [],
    archived: overrides.archived ?? false,
    fileCount: overrides.fileCount ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const NOW = new Date("2026-05-21T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sortSubjects", () => {
  it("urgency: subjects with testDate come first, soonest first; no-date last", () => {
    const a = s({ id: "a", name: "A", testDate: "2026-05-25" }); // 4 days
    const b = s({ id: "b", name: "B", testDate: "2026-05-22" }); // 1 day
    const c = s({ id: "c", name: "C", testDate: null });
    const result = sortSubjects([a, b, c], "urgency");
    expect(result.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });

  it("recent: by updatedAt DESC", () => {
    const a = s({ id: "a", updatedAt: "2026-05-20T00:00:00.000Z" });
    const b = s({ id: "b", updatedAt: "2026-05-21T00:00:00.000Z" });
    expect(sortSubjects([a, b], "recent").map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("alpha: by name ASC, case-insensitive", () => {
    const a = s({ id: "a", name: "biology" });
    const b = s({ id: "b", name: "Algebra" });
    expect(sortSubjects([a, b], "alpha").map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("filterSubjects", () => {
  const subjects = [
    s({ id: "a", name: "Biology", testLabel: "Final exam" }),
    s({ id: "b", name: "US History", testLabel: "Unit 4 quiz" }),
    s({ id: "c", name: "Algebra II", testLabel: null }),
  ];

  it("empty query returns all", () => {
    expect(filterSubjects(subjects, "").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("matches subject name (case-insensitive)", () => {
    expect(filterSubjects(subjects, "bio").map((x) => x.id)).toEqual(["a"]);
  });

  it("matches testLabel", () => {
    expect(filterSubjects(subjects, "quiz").map((x) => x.id)).toEqual(["b"]);
  });

  it("trims whitespace", () => {
    expect(filterSubjects(subjects, "  bio  ").map((x) => x.id)).toEqual(["a"]);
  });

  it("returns empty for unmatched", () => {
    expect(filterSubjects(subjects, "zebra")).toEqual([]);
  });
});

describe("pickSoonestSubject", () => {
  it("returns null when list is empty", () => {
    expect(pickSoonestSubject([])).toBeNull();
  });

  it("returns null when no subject has a future testDate", () => {
    expect(pickSoonestSubject([s({ testDate: null })])).toBeNull();
    expect(pickSoonestSubject([s({ testDate: "2026-01-01" })])).toBeNull(); // past
  });

  it("picks the subject with the soonest future testDate", () => {
    const subjects = [
      s({ id: "a", testDate: "2026-05-30" }),
      s({ id: "b", testDate: "2026-05-22" }),
      s({ id: "c", testDate: "2026-06-10" }),
    ];
    expect(pickSoonestSubject(subjects)?.id).toBe("b");
  });

  it("skips archived subjects", () => {
    const subjects = [
      s({ id: "a", testDate: "2026-05-22", archived: true }),
      s({ id: "b", testDate: "2026-05-25", archived: false }),
    ];
    expect(pickSoonestSubject(subjects)?.id).toBe("b");
  });
});

describe("urgencyTier", () => {
  it("urgent for ≤3 days", () => {
    expect(urgencyTier("2026-05-22")).toBe("urgent"); // 1 day
    expect(urgencyTier("2026-05-24")).toBe("urgent"); // 3 days
  });
  it("warn for 4–7 days", () => {
    expect(urgencyTier("2026-05-25")).toBe("warn"); // 4 days
    expect(urgencyTier("2026-05-28")).toBe("warn"); // 7 days
  });
  it("ok for 8–14 days", () => {
    expect(urgencyTier("2026-06-04")).toBe("ok"); // 14 days
  });
  it("neutral beyond 14 days", () => {
    expect(urgencyTier("2026-06-05")).toBe("neutral");
  });
  it("neutral when no date", () => {
    expect(urgencyTier(null)).toBe("neutral");
  });
});

describe("formatRelativeTime", () => {
  it("uses 'just now' for <60s", () => {
    expect(formatRelativeTime("2026-05-21T11:59:30.000Z")).toBe("just now");
  });
  it("uses minutes for <1h", () => {
    expect(formatRelativeTime("2026-05-21T11:30:00.000Z")).toBe("30 min ago");
  });
  it("uses hours for <24h", () => {
    expect(formatRelativeTime("2026-05-21T09:00:00.000Z")).toBe("3 hours ago");
  });
  it("uses 'Yesterday · TIME' for 1 day ago", () => {
    const out = formatRelativeTime("2026-05-20T16:12:00.000Z");
    expect(out.startsWith("Yesterday ·")).toBe(true);
  });
  it("uses date only for >7 days", () => {
    const out = formatRelativeTime("2026-05-13T00:00:00.000Z");
    expect(out).toMatch(/May 13/); // formatting may vary by locale
  });
});
```

- [ ] **Step 14.2: Run — expect failure**

```bash
npm test -- lib/desk.test.ts
```

- [ ] **Step 14.3: Implement `lib/desk.ts`**

Create `lib/desk.ts`:

```ts
import type { Subject } from "@/lib/cloud-subjects";

export type SortMode = "urgency" | "recent" | "alpha";
export type Urgency = "urgent" | "warn" | "ok" | "neutral";

const DAY_MS = 1000 * 60 * 60 * 24;

export function daysUntil(testDate: string | null, now: Date = new Date()): number | null {
  if (!testDate) return null;
  const target = new Date(testDate);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / DAY_MS);
}

export function urgencyTier(testDate: string | null, now: Date = new Date()): Urgency {
  const days = daysUntil(testDate, now);
  if (days === null) return "neutral";
  if (days <= 3) return "urgent";
  if (days <= 7) return "warn";
  if (days <= 14) return "ok";
  return "neutral";
}

export function sortSubjects(subjects: Subject[], mode: SortMode, now: Date = new Date()): Subject[] {
  const copy = subjects.slice();
  if (mode === "urgency") {
    copy.sort((a, b) => {
      const da = daysUntil(a.testDate, now);
      const db = daysUntil(b.testDate, now);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  } else if (mode === "recent") {
    copy.sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : b.updatedAt > a.updatedAt ? 1 : 0));
  } else {
    copy.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }
  return copy;
}

export function filterSubjects(subjects: Subject[], query: string): Subject[] {
  const q = query.trim().toLowerCase();
  if (!q) return subjects;
  return subjects.filter((s) => {
    const name = s.name.toLowerCase();
    const label = (s.testLabel ?? "").toLowerCase();
    return name.includes(q) || label.includes(q);
  });
}

export function pickSoonestSubject(subjects: Subject[], now: Date = new Date()): Subject | null {
  const future = subjects.filter((s) => {
    if (s.archived) return false;
    const days = daysUntil(s.testDate, now);
    return days !== null && days >= 0;
  });
  if (future.length === 0) return null;
  return future.reduce((best, s) => {
    const dBest = daysUntil(best.testDate, now)!;
    const dS = daysUntil(s.testDate, now)!;
    return dS < dBest ? s : best;
  });
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = now.getTime() - t;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) {
    const time = new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Yesterday · ${time}`;
  }
  if (diffDay < 7) {
    return `${diffDay} days ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
```

- [ ] **Step 14.4: Run — expect pass**

```bash
npm test -- lib/desk.test.ts
```

Expected: all tests pass. If `formatRelativeTime` tests fail due to locale formatting differences in your env, loosen the assertions to `.toMatch(/May 13|13 May/)` etc.

- [ ] **Step 14.5: Commit**

```bash
git add lib/desk.ts lib/desk.test.ts
git commit -m "feat(desk): pure helpers for sort/filter/soonest/urgency/relative-time"
```

---

## Task 15: `activity-text.ts` mapper with tests

**Files:**
- Create: `lib/activity-text.ts`
- Create: `lib/activity-text.test.ts`

- [ ] **Step 15.1: Write the failing tests**

Create `lib/activity-text.test.ts`:

```ts
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
```

- [ ] **Step 15.2: Run — expect failure**

```bash
npm test -- lib/activity-text.test.ts
```

- [ ] **Step 15.3: Implement `lib/activity-text.ts`**

Create `lib/activity-text.ts`:

```ts
import type { ActivityEvent } from "@/lib/activity";

export type ActivityIconKey = "gen" | "edit" | "upload" | "new";

export type RenderedActivity = {
  iconKey: ActivityIconKey;
  text: string;
};

function fileLabel(mimeType: string | undefined, count: number): string {
  if (mimeType === "application/pdf") return count === 1 ? "PDF" : "PDFs";
  // Default: image/anything else → photo
  return count === 1 ? "photo" : "photos";
}

export function renderActivity(event: ActivityEvent): RenderedActivity {
  const subject = event.subjectName ?? "a subject";
  const data = event.data as Record<string, unknown>;

  switch (event.type) {
    case "cheatsheet_generated":
      return { iconKey: "gen", text: `Generated cheat sheet for ${subject}` };

    case "cheatsheet_refined": {
      const topic = typeof data.topic === "string" && data.topic.length > 0 ? data.topic : "the sheet";
      return { iconKey: "edit", text: `Refined ${topic} in ${subject}` };
    }

    case "chat_question": {
      const topic = typeof data.topic === "string" && data.topic.length > 0 ? data.topic : "a question";
      return { iconKey: "edit", text: `Asked about ${topic} in ${subject}` };
    }

    case "files_uploaded": {
      const count = typeof data.count === "number" ? data.count : 1;
      const mimeType = typeof data.mimeType === "string" ? data.mimeType : undefined;
      return { iconKey: "upload", text: `Uploaded ${count} ${fileLabel(mimeType, count)} to ${subject}` };
    }

    case "subject_created": {
      const name = typeof data.name === "string" ? data.name : subject;
      return { iconKey: "new", text: `Created new subject ${name}` };
    }
  }
}
```

- [ ] **Step 15.4: Run — expect pass**

```bash
npm test -- lib/activity-text.test.ts
```

- [ ] **Step 15.5: Commit**

```bash
git add lib/activity-text.ts lib/activity-text.test.ts
git commit -m "feat(activity): renderActivity mapper for the five event types"
```

---

## Task 16: `subject-card.tsx` rewrite

**Files:**
- Modify: `components/subject-card.tsx`

- [ ] **Step 16.1: Replace the file**

Overwrite `components/subject-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { BookOpen, ImageIcon, MessageSquare, RotateCcw, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countdownLabel, countdownTone, daysUntil } from "@/lib/utils";
import type { Subject } from "@/lib/cloud-subjects";

type Props = {
  subject: Subject;
  onChat?: (subject: Subject) => void;
  onRegenerate?: (subject: Subject) => void;
  onArchive?: (subject: Subject) => void;
};

export function SubjectCard({ subject, onChat, onRegenerate, onArchive }: Props) {
  const days = daysUntil(subject.testDate);
  const tone = countdownTone(days);
  const label = countdownLabel(days);

  return (
    <div className="group relative flex flex-col gap-3 border border-default bg-surface p-5 transition-all hover:-translate-y-[1px] hover:border-strong">
      <Link
        href={`/subjects/${subject.id}`}
        className="absolute inset-0 z-0"
        aria-label={`Open ${subject.name}`}
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <BookOpen className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="relative z-10 flex flex-col gap-1">
        <h3
          className="text-[1.2rem] leading-tight tracking-tight text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {subject.name}
        </h3>
        {subject.testLabel ? (
          <p className="text-sm text-ink-muted">{subject.testLabel}</p>
        ) : null}
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-default pt-3 text-sm">
        <span className="flex items-center gap-1.5 text-ink-faint">
          <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
          <span className="tabular">
            {subject.fileCount} {subject.fileCount === 1 ? "file" : "files"}
          </span>
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onChat ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChat(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title="Open chat"
              aria-label={`Open chat for ${subject.name}`}
            >
              <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {onRegenerate ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRegenerate(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title="Regenerate cheat sheet"
              aria-label={`Regenerate cheat sheet for ${subject.name}`}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {onArchive ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onArchive(subject); }}
              className="flex h-7 w-7 items-center justify-center border border-default bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              title={subject.archived ? "Unarchive" : "Archive"}
              aria-label={subject.archived ? `Unarchive ${subject.name}` : `Archive ${subject.name}`}
            >
              <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

The Link is now absolute-positioned across the card and quick-action buttons have `e.stopPropagation()` so they don't trigger navigation.

- [ ] **Step 16.2: Verify no other callers expect the old `fileCount` prop**

The old version took `fileCount` as a separate prop. The home page currently passes `fileCount={0}` — that goes away when the home page rewrite (Task 18) lands. Other callers? Search:

```bash
grep -rn "SubjectCard" --include="*.tsx" /c/Users/spexr/pufferstudy
```

Expected: only `app/page.tsx` (which we're about to rewrite). If any other file appears, update it to remove the prop.

- [ ] **Step 16.3: Run typecheck**

```bash
npm run typecheck
```

Expected error: `app/page.tsx` still passes `fileCount={0}` but that's a *spurious* extra prop now (TypeScript will allow extra props on JSX with `Props` types in some configs; if it errors, that's fine — we replace `app/page.tsx` in Task 18). If the error is blocking, edit `app/page.tsx` to drop the `fileCount={0}` arg temporarily.

- [ ] **Step 16.4: Commit**

```bash
git add components/subject-card.tsx
git commit -m "feat(card): use subject.fileCount; add hover quick-actions for chat/regenerate/archive"
```

---

## Task 17: `today-panel.tsx`, `activity-feed.tsx`, `upcoming-timeline.tsx`, `subjects-grid.tsx`

This task creates the four desk modules. Each is small and independent.

**Files:**
- Create: `components/today-panel.tsx`
- Create: `components/activity-feed.tsx`
- Create: `components/upcoming-timeline.tsx`
- Create: `components/subjects-grid.tsx`

- [ ] **Step 17.1: `components/today-panel.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pickSoonestSubject, urgencyTier, daysUntil } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

type Props = {
  subjects: Subject[];
};

export function TodayPanel({ subjects }: Props) {
  const focus = React.useMemo(() => pickSoonestSubject(subjects), [subjects]);

  if (!focus) {
    return (
      <div className="border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</p>
        <h2
          className="mb-1.5 text-[1.4rem] leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Nothing scheduled yet
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          Add a subject and a test date to see what to study next.
        </p>
        <Button asChild>
          <Link href="/subjects/new">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add your first subject
          </Link>
        </Button>
      </div>
    );
  }

  const days = daysUntil(focus.testDate);
  const tier = urgencyTier(focus.testDate);

  const urgencyClass =
    tier === "urgent"
      ? "bg-[color:var(--danger)] text-white"
      : tier === "warn"
      ? "bg-[color:var(--warning)] text-white"
      : "bg-[color:var(--accent)] text-[color:var(--primary-foreground)]";

  const dayCopy = days === null ? "" : days === 0 ? "Today" : days === 1 ? "1 day away" : `${days} days away`;

  return (
    <div className="border-l-[3px] border-l-[var(--accent)] border border-default bg-surface p-5">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today</p>
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${urgencyClass}`}
      >
        {tier === "urgent" ? "🔥 " : ""}{dayCopy}
      </span>
      <h2
        className="mt-3 text-[1.5rem] leading-tight text-ink"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {focus.name}{focus.testLabel ? ` — ${focus.testLabel}` : ""}
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        {focus.fileCount} {focus.fileCount === 1 ? "file" : "files"}
        {focus.cheatsheetGeneratedAt ? " · sheet ready" : ""}
      </p>
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link href={`/subjects/${focus.id}`}>
            Open subject
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link href={`/subjects/${focus.id}/cheatsheet`}>
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
            Chat
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 17.2: `components/activity-feed.tsx`**

```tsx
"use client";

import * as React from "react";
import { Sparkles, Pencil, MessageSquare, Paperclip, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityEvent } from "@/lib/activity";
import { renderActivity, type ActivityIconKey } from "@/lib/activity-text";
import { formatRelativeTime } from "@/lib/desk";

const ICONS: Record<ActivityIconKey, LucideIcon> = {
  gen: Sparkles,
  edit: Pencil,
  upload: Paperclip,
  new: Plus,
};

export function ActivityFeed() {
  const [events, setEvents] = React.useState<ActivityEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/activity?limit=10", { cache: "no-store" });
        if (!res.ok) throw new Error(`activity ${res.status}`);
        const data = (await res.json()) as { events: ActivityEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load activity.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="border border-default bg-surface p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Recent activity</p>

      {error ? (
        <p className="text-sm text-ink-muted">{error}</p>
      ) : events === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse bg-surface-2/60" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-ink-muted">No activity yet. Generate a cheat sheet or chat about one to see updates here.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const r = renderActivity(event);
            const Icon = ICONS[r.iconKey];
            return (
              <li key={event.id} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-default bg-surface-2 text-ink-muted">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="text-sm leading-snug text-ink">
                  {r.text}
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    {formatRelativeTime(event.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 17.3: `components/upcoming-timeline.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { daysUntil, urgencyTier } from "@/lib/desk";
import type { Subject } from "@/lib/cloud-subjects";

const WINDOW_DAYS = 21;

type Props = {
  subjects: Subject[];
};

export function UpcomingTimeline({ subjects }: Props) {
  const now = new Date();

  const dots = React.useMemo(() => {
    return subjects
      .filter((s) => !s.archived)
      .map((s) => {
        const d = daysUntil(s.testDate, now);
        return d !== null && d >= 0 && d <= WINDOW_DAYS
          ? { subject: s, days: d, tier: urgencyTier(s.testDate, now) }
          : null;
      })
      .filter((x): x is { subject: Subject; days: number; tier: ReturnType<typeof urgencyTier> } => x !== null);
  }, [subjects]);

  return (
    <div className="border border-default bg-surface p-5">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint">Upcoming · next 3 weeks</p>

      {dots.length === 0 ? (
        <p className="py-2 text-sm text-ink-muted">No tests scheduled in the next 3 weeks.</p>
      ) : (
        <div className="relative pt-6 pb-9">
          {/* week labels */}
          {[
            { left: 0, label: "Today" },
            { left: 33, label: "+1 wk" },
            { left: 66, label: "+2 wks" },
            { left: 100, label: "+3 wks" },
          ].map(({ left, label }) => (
            <div
              key={left}
              className="absolute top-0 -translate-x-1/2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"
              style={{ left: `${left}%` }}
            >
              {label}
            </div>
          ))}
          {/* track */}
          <div className="relative h-[3px] bg-surface-3">
            {/* week tick marks */}
            {[0, 33, 66, 100].map((left) => (
              <div
                key={left}
                className="absolute w-px h-4 -top-1.5 bg-[color:var(--border-strong)]"
                style={{ left: `${left}%` }}
              />
            ))}
            {dots.map(({ subject, days, tier }) => {
              const left = (days / WINDOW_DAYS) * 100;
              const dotColor =
                tier === "urgent"
                  ? "var(--danger)"
                  : tier === "warn"
                  ? "var(--warning)"
                  : "var(--accent)";
              return (
                <React.Fragment key={subject.id}>
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="absolute -top-[7px] block h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--surface)] shadow-soft"
                    style={{ left: `${left}%`, background: dotColor }}
                    title={`${subject.name} · in ${days} day${days === 1 ? "" : "s"}`}
                  />
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="absolute top-[18px] -translate-x-1/2 whitespace-nowrap border border-default bg-surface px-1 py-0.5 text-[11px] font-semibold text-ink"
                    style={{ left: `${left}%` }}
                  >
                    {subject.name}
                  </Link>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 17.4: `components/subjects-grid.tsx`**

```tsx
"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { SubjectCard } from "@/components/subject-card";
import { sortSubjects, filterSubjects, type SortMode } from "@/lib/desk";
import { archiveSubject } from "@/lib/cloud-subjects";
import type { Subject } from "@/lib/cloud-subjects";
import { useRouter } from "next/navigation";

const SORT_KEY = "pufferstudy.deskSort";

type Props = {
  subjects: Subject[];
  onSubjectsChange: (updater: (prev: Subject[]) => Subject[]) => void;
};

function loadSort(): SortMode {
  if (typeof window === "undefined") return "urgency";
  const raw = window.localStorage.getItem(SORT_KEY);
  if (raw === "urgency" || raw === "recent" || raw === "alpha") return raw;
  return "urgency";
}

export function SubjectsGrid({ subjects, onSubjectsChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>(loadSort());
  const [showArchived, setShowArchived] = React.useState(false);

  const persistedSort = React.useCallback((m: SortMode) => {
    setSortMode(m);
    try { window.localStorage.setItem(SORT_KEY, m); } catch {}
  }, []);

  const active = subjects.filter((s) => !s.archived);
  const archived = subjects.filter((s) => s.archived);

  const visible = React.useMemo(() => {
    return sortSubjects(filterSubjects(active, query), sortMode);
  }, [active, query, sortMode]);

  const handleChat = (s: Subject) => router.push(`/subjects/${s.id}/cheatsheet`);

  const handleArchive = async (s: Subject) => {
    // Optimistic: flip locally first.
    onSubjectsChange((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, archived: !p.archived } : p))
    );
    try {
      await archiveSubject(s.id, !s.archived);
    } catch (err) {
      // Roll back on failure.
      onSubjectsChange((prev) =>
        prev.map((p) => (p.id === s.id ? { ...p, archived: s.archived } : p))
      );
      console.error("archive failed:", err);
    }
  };

  // Regenerate from the desk is non-trivial (needs the Gemini key from settings + a streaming
  // PATCH that v2.3 doesn't yet wire from the desk). For v2.3, the quick-action navigates
  // the user to the cheatsheet page where Regenerate already exists. That keeps the v2.3
  // scope tight without losing the affordance.
  const handleRegenerate = (s: Subject) => router.push(`/subjects/${s.id}/cheatsheet`);

  return (
    <div className="border border-default bg-surface p-5">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        All subjects ({active.length})
      </p>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects…"
            className="w-full border border-default bg-surface-2 px-3 py-2 pl-9 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => persistedSort(e.target.value as SortMode)}
          className="border border-strong bg-surface px-3 py-2 text-sm font-semibold text-ink"
        >
          <option value="urgency">By urgency</option>
          <option value="recent">Recently studied</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          {query ? "No subjects match that search." : "Add your first subject to get started."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              onChat={handleChat}
              onRegenerate={handleRegenerate}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mt-5 w-full border-t border-dashed border-default pt-3 text-center text-sm font-semibold text-ink-faint hover:text-ink-muted"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {archived.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 17.5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 17.6: Commit**

```bash
git add components/today-panel.tsx components/activity-feed.tsx components/upcoming-timeline.tsx components/subjects-grid.tsx
git commit -m "feat(desk): TodayPanel, ActivityFeed, UpcomingTimeline, SubjectsGrid components"
```

---

## Phase E — Compose + ship

## Task 18: Rewrite `app/page.tsx` as Layout C

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 18.1: Replace the page**

Overwrite `app/page.tsx`:

```tsx
"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import { useSubjects } from "@/lib/cloud-subjects";
import { TodayPanel } from "@/components/today-panel";
import { ActivityFeed } from "@/components/activity-feed";
import { UpcomingTimeline } from "@/components/upcoming-timeline";
import { SubjectsGrid } from "@/components/subjects-grid";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function DeskPage() {
  const { subjects: loaded, error, refresh } = useSubjects();
  const { user } = useUser();

  // Local mirror so optimistic updates (archive) don't wait for refresh.
  const [subjects, setSubjects] = React.useState<typeof loaded>(loaded);
  React.useEffect(() => { setSubjects(loaded); }, [loaded]);

  React.useEffect(() => {
    function onFocus() { refresh(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const ready = subjects !== null;
  const items = subjects ?? [];
  const activeCount = items.filter((s) => !s.archived).length;

  const greetingName = user?.firstName ?? "back";
  const focus = items.find((s) => !s.archived && s.testDate);
  const focusSummary = focus ? ` · ${focus.name} test soon` : "";

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            Welcome back,{" "}
            <span className="italic" style={{ color: "var(--accent-deep)" }}>
              {greetingName}
            </span>
          </h1>
          <p className="text-sm text-ink-muted sm:text-base">
            Your study desk · {activeCount} active {activeCount === 1 ? "subject" : "subjects"}{focusSummary}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/subjects/new">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New subject
          </Link>
        </Button>
      </header>

      {error ? (
        <div className="mb-6 border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      {!ready ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-1" />
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-1 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <TodayPanel subjects={items} />
            <ActivityFeed />
          </aside>
          <section className="flex flex-col gap-4 lg:col-span-2">
            <UpcomingTimeline subjects={items} />
            <SubjectsGrid
              subjects={items}
              onSubjectsChange={(updater) =>
                setSubjects((prev) => (prev ? updater(prev) : prev))
              }
            />
          </section>
        </div>
      )}
    </div>
  );
}
```

Notes:
- The `lg:grid-cols-3` + `lg:col-span-1`/`lg:col-span-2` pairs give the 1/3 + 2/3 split called for in the spec.
- The `useSubjects` hook returns server-fetched subjects; we mirror to local state for optimistic archive updates without waiting for a re-fetch.

- [ ] **Step 18.2: Run typecheck and build**

```bash
npm run typecheck && npm run build
```

Expected: green.

- [ ] **Step 18.3: Smoke-test in dev**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected:
- New serif greeting H1 with first name in italic gold.
- Two-column layout on a wide window: rail with Today + Activity, right with Timeline + Grid.
- Theme picker swap recolors everything immediately.
- Search filters the grid; sort dropdown reorders; archive flips the card and reveals "Show archived" toggle.
- Subject cards link to `/subjects/[id]`; quick action ✏️/💬/⊠ each work without navigating the card.

Stop the dev server.

- [ ] **Step 18.4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(desk): rewrite home page as Layout C composing the four modules"
```

---

## Task 19: Manual E2E, tag v2.3.0, push

**Files:** none (verification + git).

- [ ] **Step 19.1: Run the full test suite**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all green.

- [ ] **Step 19.2: Manual E2E walkthrough**

Run `npm run dev` and verify each item from the spec's "Manual E2E" section:

1. Fresh load with multiple subjects → Today shows the soonest non-archived subject, Timeline shows all in window with correct color tiers, Activity feed shows the most-recent 10 events.
2. Switch theme via dropdown → page recolors immediately. Refresh — choice persists. (Verifies anti-flash script.)
3. Migration: in DevTools console run `localStorage.setItem("next-themes-theme","dark"); localStorage.setItem("pufferstudy.theme","dark"); location.reload();` → resolves to `spacegrey`.
4. Archive a subject via quick-action → it leaves the grid, "Show archived (1)" toggle appears below.
5. Generate a cheat sheet via `/subjects/[id]/cheatsheet` → refresh the home page, the new event appears at the top of the activity feed.
6. With no subjects (test with a fresh Clerk account), the Today panel shows "Nothing scheduled yet" with the "Add your first subject" CTA. The grid shows "Add your first subject to get started."
7. Resize to <1024px → all four modules stack into a single column in this DOM order: Today → Activity → Timeline → Grid. Sticky is disabled.
8. Print preview (Ctrl+P) → app bar hidden, footer hidden, sheet area renders. (The desk itself isn't designed to print — verify nothing crashes.)

If any step fails, fix it in a new task before tagging.

- [ ] **Step 19.3: Tag and push**

```bash
git tag v2.3.0
git push origin main
git push origin v2.3.0
```

Vercel auto-deploys from `main`. Wait for the deploy to complete, then visit https://pufferstudy.vercel.app and re-walk the E2E. If the canonical alias is stale, re-alias per the v2.0 gotcha:

```bash
vercel alias set https://<latest-deploy-url> pufferstudy.vercel.app --scope mstackinmoney-2723s-projects
```

- [ ] **Step 19.4: Update memory and roadmap**

Update `C:\Users\spexr\.claude\projects\C--Users-spexr\memory\pufferstudy-resume.md` and `pufferstudy-roadmap.md` to mark v2.3 shipped. Update the next-known-work-item line to v3.0 (Assignments module).

Update `docs/superpowers/roadmap.md` to add a "v2.3 shipped 2026-XX-XX" note next to that release.

---

## Out of scope (reminder)

- Spaced repetition, streaks, study time tracking.
- The `/activity` page (the "View all" link is omitted from the activity-feed component intentionally).
- Drag-to-reorder on subjects.
- Inline "create subject" form on the desk.
- Activating the `practice` mode UI.
- Cheat-sheet regenerate from the desk quick-action — for v2.3, that quick action deep-links to the cheatsheet page where regenerate already exists. Full inline regenerate is deferred to v3.x if usage demands.
