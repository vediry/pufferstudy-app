# PufferStudy v2.3 — Study desk redesign

## Problem

The current home page at `/` is a single 1/2/3-column subject grid with one button (`+ New subject`) and an `<h1>Your study desk</h1>`. It works, but it doesn't act like a workspace:

- No surfacing of what to study right now. The student has to scan all cards and find the urgent one.
- No sense of recent activity — nothing tells you what you did yesterday or where you left off.
- No visual context for the test schedule (every card has its own countdown, but there's no shared timeline view).
- The subjects grid has gaps: file count hardcodes to 0, no search, no sort, no archive, no per-card quick actions.
- The Light / Dark / Forest themes feel student-project utilitarian, not the premium "study room" feel the brand should have.
- It is not designed to host future per-subject modules (assignments, flashcards, study guides) that the roadmap calls for.

v2.3 redesigns the desk as the **cross-subject workspace spine** that future modules plug into. The visual treatment is upgraded to a premium, ambient aesthetic with four metallic-feeling themes.

## Goals

- Surface the most urgent thing to study at the top of the page.
- Show what the student recently did, across all subjects, in a glanceable feed.
- Give a single shared timeline of upcoming tests.
- Upgrade the subjects grid with real file counts, search, sort, archive, and quick actions.
- Replace the existing Light/Dark/Forest themes with four richer premium themes; default to Gold Atelier.
- Build all of it on a layout that can host v3.0+ module content without restructuring (assignments slot into Today, flashcards-to-review slot into Today or a new rail module, etc.).

## Non-goals

- Spaced-repetition scheduling, study analytics, streaks. (No session tracking infra in v2.3.)
- Assignments, flashcards, study guides themselves — those are v3.0+.
- Activating the existing stubbed `practice` mode in the UI. (v3.3.)
- Custom domain unification.
- Drag-to-reorder on subjects.
- Inline "create subject" on the desk — `/subjects/new` remains its own route.

## Architecture

### Files touched

| File | Change |
| --- | --- |
| `app/page.tsx` | Rewrite as the Layout C desk. Compose the four modules. |
| `app/layout.tsx` | Add the new `<AppBar>` (brand + theme picker + Clerk UserButton). Apply `data-theme` attribute from theme provider. |
| `components/app-bar.tsx` | New component. Brand wordmark, theme dropdown, avatar. |
| `components/theme-picker.tsx` | New component. Dropdown showing the 4 themes with active checkmark. |
| `components/today-panel.tsx` | New. Renders the most-urgent subject with CTAs. Returns null if no subjects. |
| `components/activity-feed.tsx` | New. Reads last 10 events from `/api/activity`. |
| `components/upcoming-timeline.tsx` | New. Horizontal timeline of next 3 weeks of test dates. |
| `components/subjects-grid.tsx` | New (extracted from current `page.tsx`). Hosts search, sort, archived-toggle, grid. |
| `components/subject-card.tsx` | Extend: accept real `fileCount`, render quick-actions on hover (chat / regenerate / archive). |
| `lib/themes.ts` | New. Defines the 4 themes as CSS variable maps. |
| `lib/theme-provider.tsx` | New. Reads/writes user theme preference, sets `data-theme` on `<html>`. |
| `app/globals.css` | Add the per-theme CSS variable blocks under `[data-theme="atelier"]` etc. Remove Light/Dark/Forest blocks. |
| `app/api/activity/route.ts` | New. `GET` returns last N events for the current user. |
| `app/api/subjects/route.ts` | Extend `GET` to include `fileCount` per subject. |
| `app/api/subjects/[id]/route.ts` | Extend `PATCH` to accept `archived` boolean. |
| `lib/activity.ts` | New. `logActivity(event)` helper called from `/api/generate`, file upload endpoint, subject creation, chat PATCH. |
| `lib/cloud-subjects.ts` | Extend `Subject` type with `fileCount?: number` and `archived: boolean`. Add `archiveSubject(id, archived)` helper. |
| `lib/user-preferences.ts` | New. `getThemePreference()` / `setThemePreference()`, backed by Clerk `publicMetadata` or a `user_preferences` table — see Open questions. |

### DB changes

```sql
-- New: activity log
CREATE TABLE activity_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  subject_id    TEXT,                          -- nullable for user-level events
  event_type    TEXT NOT NULL,                 -- see Event types below
  event_data    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_user_recent_idx ON activity_log (user_id, created_at DESC);

-- New: archived flag on subjects
ALTER TABLE subjects ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
```

Both migrations use `sql.query()` (not the tagged template) per the v2.0 gotcha about DDL silently failing.

## Layout

Layout C (locked during brainstorming).

### Desktop (`≥1024px`)

- Container: `max-w-[1280px]` (matches the v2.2 cheatsheet route).
- Two-column flex/grid row. Left rail `flex-[1]`, right column `flex-[2]` — about 33/67.
- Left rail is `sticky top-6 self-start max-h-[calc(100vh-6rem)]` so it stays in view as the right column scrolls.
- Gap between columns: `24px`.

### Mobile (`<1024px`)

- Single column. DOM order: Today → Activity feed → Upcoming timeline → Subjects grid.

### App bar

Persistent across the app (lives in `app/layout.tsx`):

- Left: brand wordmark `Puffer` + italic gold `Study` in Instrument Serif.
- Right: theme picker dropdown, then Clerk UserButton.

## Modules

### 1. Today panel (rail)

- Picks the subject with the soonest `testDate` in the future.
- Shows: urgency pill (color scales: red `≤3d`, orange `≤7d`, gold `≤14d`, neutral after), serif H2 with subject name + test label, `meta` line ("Last studied X" + file counts).
- Two CTAs: **Open subject →** (primary gold gradient) and **💬 Chat** (secondary, deep-links to `/subjects/[id]/cheatsheet`).
- Empty state: if there are no subjects or no upcoming tests, render an inviting card prompting the student to add their first subject.
- Future-extensibility note: the panel's content area is a `<TodayContent>` slot. v3.0 appends assignments-due rows; v3.1 appends flashcards-to-review rows. v2.3 ships with the test-countdown content only.

### 2. Recent activity feed (rail)

- Pulls last 10 events from `GET /api/activity?limit=10`.
- Event types and presentation:

| Event type | Icon | Text template |
| --- | --- | --- |
| `cheatsheet_generated` | ⚡ gen | "Generated cheat sheet for **{subject}**" |
| `cheatsheet_refined` | ✏️ edit | "Refined **{topic}** in {subject}" (topic = first 6 words of user message) |
| `chat_question` | 💬 edit-style | "Asked about **{topic}** in {subject}" (topic = first 6 words of user message) |
| `files_uploaded` | 📎 upload | "Uploaded {n} {photo/PDF/file} to **{subject}**" |
| `subject_created` | ＋ new | "Created new subject **{subject}**" |

- "View all →" link goes to `/activity` — out of scope for v2.3 (link can be present and route to a "Coming soon" placeholder, OR omit until v3.0). Default: omit the link for now.
- Time formatting: relative for <24h ("3 hours ago"), date+time for <7d ("Yesterday · 9:48 AM"), date only beyond ("May 18").

### 3. Upcoming timeline (right column)

- Horizontal track spanning next 3 weeks (21 days).
- Week markers at 0%, 33%, 66%, 100% labeled "Today / +1 wk / +2 wks / +3 wks".
- One dot per subject whose `testDate` falls in the window. Dot color matches the urgency tier (red/orange/gold). Label sits beneath the dot, never overlaps the track.
- Subjects with no test date or beyond the window are not shown.
- Click a dot → navigate to that subject.
- Tooltip on hover shows subject + exact date.

### 4. Subjects grid (right column)

- Section title "All subjects (N)" where N is the unarchived count.
- Controls row: search input (filters by subject name) + sort dropdown (By urgency / Recently studied / Alphabetical).
- 2-column grid inside the section on desktop (cleaner than 3 within the 67% column). 1-column on mobile.
- Cards retain today's structure but with three additions:
  - **Real file count** instead of `0`. Backed by the extended `/api/subjects` response.
  - **Quick-actions row** appears on hover at the bottom of the card. Three actions: Chat (deep-link), Regenerate (POST to `/api/generate?mode=cheatsheet`), Archive (PATCH `archived: true`).
  - **Card name** uses Instrument Serif to match the desk's premium feel.
- Below the grid: dashed-top "📦 Show archived (N)" toggle. Click expands a section below that shows archived cards with an "Unarchive" action.

## Theme system

### The four themes

| Theme | Mode | Palette | Headings | Body |
| --- | --- | --- | --- | --- |
| **Gold Atelier** (default) | light | warm cream parchment + gold leaf accent + espresso ink | Instrument Serif | Manrope |
| **Platinum Cloud** | light | soft white + brushed silver gradients + slate ink | Manrope | Manrope |
| **Space Grey** | dark | deep graphite + warm cream text + soft gold accent | Manrope | Manrope |
| **Midnight Library** | dark | navy-black + ivory text + champagne gold accent | Instrument Serif | Manrope |

Full CSS variable values are committed in `lib/themes.ts` and referenced from `app/globals.css` via attribute selectors:

```css
:root[data-theme="atelier"] {
  --bg-grad-top: #faf6ec;
  --bg-grad-bottom: #f3ecd9;
  --surface: #fffaef;
  --ink: #2c241a;
  --accent: #b08842;
  /* …etc */
}
```

### Switcher

- Lives in the app bar, right of the brand.
- Shows the active theme name + a swatch + `▾` chevron.
- Click opens a dropdown listing all 4 with a swatch and a `✓` on the active one.
- Selecting one immediately updates `data-theme` on `<html>` (no flash) and persists.

### Persistence

- Read on mount: theme provider checks `localStorage["pufferstudy.theme"]` first, falls back to server preference (Clerk `publicMetadata.theme`), defaults to `atelier`.
- Write on change: update `localStorage` immediately and fire-and-forget a `PATCH` to update the Clerk metadata so other devices follow.
- No SSR flash: the theme provider injects a tiny inline script in `app/layout.tsx`'s `<head>` that reads localStorage and sets `data-theme` on `<html>` before React hydrates.

### Migration from Light/Dark/Forest

- Users with stored `light` → `atelier`, `dark` → `spacegrey`, `forest` → `atelier` (forest's warmth maps cleanest to atelier's gold accent over the moss green that's no longer the brand color).
- Migration runs once on the first v2.3 mount.

## Activity logging

### Where events are written

- `app/api/generate/route.ts` (cheatsheet mode) → `cheatsheet_generated` on `onDone`.
- `app/api/subjects/[id]/route.ts` PATCH handler — when `chatMessages` lengthens, write `chat_question` for the user msg and `cheatsheet_refined` for the assistant msg if `sheetEdited`.
- `app/api/subjects/[id]/files/route.ts` POST → `files_uploaded` with `{ count, mime_types }`.
- `app/api/subjects/route.ts` POST → `subject_created`.

All writes use the `logActivity` helper in `lib/activity.ts`. Helper is fire-and-forget — failure to log never blocks the user-facing operation.

### Read endpoint

`GET /api/activity?limit=10` returns the most recent events for `auth().userId`, scoped via the new index. Response shape:

```ts
type ActivityEvent = {
  id: number;
  subjectId: string | null;
  subjectName: string | null;     // joined for display convenience
  type: "cheatsheet_generated" | "cheatsheet_refined" | "chat_question" | "files_uploaded" | "subject_created";
  data: Record<string, unknown>;
  createdAt: string;              // ISO
};
```

## Subjects grid changes — detail

### File count bug

Today's `app/page.tsx` passes `fileCount={0}` because the subject list endpoint doesn't return file counts. Fix:

- Extend `GET /api/subjects` to compute and return `fileCount` per subject (`SELECT s.*, COUNT(f.id) AS file_count FROM subjects s LEFT JOIN files f ON f.subject_id = s.id WHERE s.user_id = $1 GROUP BY s.id`).
- `Subject` type gains `fileCount: number`.
- `useSubjects()` exposes it.
- `SubjectCard` reads `subject.fileCount` instead of the prop.

### Search

- Client-side filter on `subject.name` (and `subject.testLabel`), case-insensitive substring.
- Debounced 120ms.
- No server roundtrip — the subject list is small enough.

### Sort

- Three options:
  - `urgency` (default): subjects with a `testDate` come first, soonest first; then subjects without a date.
  - `recent`: by `updated_at DESC`.
  - `alpha`: by name ASC.
- Sort choice persists in `localStorage["pufferstudy.deskSort"]`.

### Archive

- New `archived BOOLEAN` on subjects (see DB changes).
- Quick action on each card → `PATCH /api/subjects/[id]` with `{ archived: true }`.
- Archived subjects are excluded from the main grid, the Today panel, and the Upcoming timeline.
- "Show archived (N)" toggle reveals an `<ArchivedSection>` below the grid with the archived cards and an "Unarchive" quick-action.

### Quick actions

Three icons in a hover-revealed row inside each card's `<scard-meta>` footer:

- **💬 Chat** — links to `/subjects/[id]/cheatsheet` (chat panel is on that page in v2.2).
- **↻ Regenerate** — kicks off a cheatsheet regenerate via `POST /api/generate` with the same JSON body shape the cheatsheet page sends (`{ mode: "cheatsheet", apiKey, subjectName, fileIds }`). Reads the Gemini key from `getSettings()`; if missing, surfaces a toast prompting the user to add it in Settings rather than starting the request. Shows a small spinner over the card while in flight. On success, persists the new markdown via `PATCH /api/subjects/[id]` (same as the cheatsheet page does today) and a toast confirms.
- **⊠ Archive** — PATCH archived=true, optimistic UI, toast "Subject archived · Undo".

## Testing

### Unit / component

- `themes.ts`: snapshot test that all 4 themes define every required variable.
- `theme-picker.tsx`: renders 4 options, click switches `data-theme` and writes localStorage.
- `subjects-grid.tsx`: filter by search term; sort by all three options; archive removes from main grid and surfaces under toggle.
- `today-panel.tsx`: picks the soonest future `testDate`; empty state when no subjects; future-content slot renders nothing in v2.3.
- `activity-feed.tsx`: handles empty array, handles each event type's text rendering.

### API tests

- `GET /api/subjects` returns `fileCount` per subject.
- `PATCH /api/subjects/[id]` accepts `archived: boolean` and rejects anything else for that field.
- `GET /api/activity` respects `limit`, scopes to user, sorts DESC.
- `logActivity` failures do not propagate to the calling endpoint.

### Manual E2E

1. Fresh load with multiple subjects → Today shows the soonest, timeline shows all in window, activity feed shows expected event types.
2. Switch theme via dropdown → page updates immediately, refresh preserves choice.
3. Migration: with `localStorage["pufferstudy.theme"] = "dark"`, mount the app → resolves to `spacegrey`.
4. Quick action: archive a subject → it leaves the grid, "Show archived (1)" appears.
5. Generate a cheat sheet → activity feed shows the new event after page refresh.
6. Refresh with no subjects → Today shows the empty/onboarding state.
7. Mobile width → single-column stack, sticky disabled, controls remain usable.
8. Print preview → app bar and rail hide (or page is intentionally not printed; verify nothing breaks).

## Out of scope

- Multi-user collaboration on a subject.
- Activity page at `/activity` (the "View all" link is omitted in v2.3).
- Per-user storage quotas / billing UI.
- Mobile native apps.

## Open questions

- **Theme persistence location.** Clerk `publicMetadata` is the lowest-friction (no new table), but it's user-visible in Clerk's dashboard and limited to 8KB. A `user_preferences` table is cleaner but adds a migration. Decision: ship v2.3 with `publicMetadata`; revisit if more preferences accumulate.
- **Activity feed "View all" page.** Out of scope for v2.3, but the design assumes one exists. If we link to a placeholder "Coming soon" page, we ship a half-done flow. Decision: hide the link in v2.3; add it in the first release after `/activity` exists.
- **Empty Today panel copy.** Locked design says "inviting card prompting the student to add their first subject." Exact copy to be finalized during implementation.
