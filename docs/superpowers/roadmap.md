# PufferStudy roadmap

_Last updated 2026-05-21_

## Product vision

PufferStudy is evolving from "AI cheat-sheet generator" into a **per-subject study workspace**. Each subject becomes a hub that holds everything a student needs to learn and study that subject: notes, AI-generated study materials, drill tools, and tracked work.

The **study desk** is the cross-subject overview — what to study today, what's due, what was recently worked on.

### Audience

Build for the maintainer's personal study workflow first. Design choices stay friendly for other students later, but no public marketing push is planned at this stage.

### Per-subject modules (target end state)

| Module | Status | Notes |
| --- | --- | --- |
| Notes / photos | Shipped (v2.0) | Image + PDF uploads, per-subject cloud-synced |
| Cheat sheet | Shipped (v2.0) | One-page AI summary, printable |
| Chat / refine | Shipped (v2.1) | Q&A + edit-in-place chat below the sheet |
| Assignments | Planned (v3.0) | Due dates, attached files, status |
| Flashcards | Planned (v3.1) | AI-generated from notes, drill mode |
| Long-form study guide | Planned (v3.2) | Multi-page deep version of the cheat sheet |
| Practice quizzes | Planned (v3.3) | Already stubbed in `lib/prompts.ts` — UI activation |

## Release plan

Each release is its own spec → plan → implementation cycle. Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.

### v2.2 — Cheat sheet chat UX cleanup (specced, plan pending)

Three coordinated changes: tightened `REFINE_SYSTEM` prompt, parser auto-detect for misformatted edits, 60/40 two-column desktop layout with a hard bubble height cap.

Spec: `docs/superpowers/specs/2026-05-21-cheatsheet-chat-v2.2-design.md`.

### v2.3 — Study desk redesign

The **spine** that future modules plug into. Ships with today's modules + the activity-feed backend, but designed extensibly so v3.0+ modules can surface their content here without restructuring the page.

Locked direction (from brainstorming): **Layout C — two-column with rail.**
- Left rail (~33% width): "Today" focus card + recent activity feed.
- Right column (~67% width): upcoming-tests timeline + subjects grid.
- Mobile: single-column stack.

Modules to host: today, upcoming timeline, activity feed, subjects grid. Future modules (assignments due, flashcards to review) will slot into the rail or the timeline section as they ship.

Spec: TBD this session.

### v3.0 — Assignments module

Per-subject assignment tracking with due dates, attached files, and status (todo / done). First module that adds real "Today" content beyond test countdowns. Once shipped, the desk's "Today" panel surfaces "Biology lab report due tomorrow" alongside test dates.

DB changes: new `assignments` table scoped on `subject_id` + `user_id`. New API routes under `/api/subjects/[id]/assignments/`.

### v3.1 — Flashcards module

AI-generated from a subject's notes. Drill mode for review. Optional spaced-repetition scheduling deferred to a follow-up if usage warrants. Highest-value new study tool — strongest product differentiation against generic AI-chat alternatives.

DB changes: new `flashcards` table scoped on `subject_id` + `user_id`. New `/api/generate` mode for flashcard creation.

### v3.2 — Long-form study guide

A multi-page, deep version of the cheat sheet. Generated from the same notes but with a different system prompt — sections, examples, worked problems, longer explanations. Smallest scope of the v3 features.

DB changes: extend `subjects` table with a `study_guide_markdown` column. New `/api/generate` mode.

### v3.3 — Practice quizzes activated

The `practice` mode in `lib/prompts.ts` already exists. UI to host the quiz flow, score the answers, and persist results. Wraps up the v3 toolkit.

DB changes: optional `quiz_attempts` table for persistence.

## Decision principles

- **Ship in slices.** Each release is independently useful and deployable. No "big bang" releases.
- **Design now, build later.** v2.3 is designed knowing v3.0–v3.3 are coming, so the desk doesn't get rewritten to accommodate them.
- **Default to existing infra.** Neon + Vercel Blob + Clerk are sufficient for everything on this roadmap. No new platform decisions needed.
- **Keep `/api/generate` as the single AI surface.** Each new module adds a new mode rather than a new route.

## Out of scope (deferred)

- Mobile native apps. Mobile web first.
- Multi-user collaboration on a subject (sharing, classmates).
- Teacher / parent views.
- Custom domain (`pufferstudy.com`). Cross-subdomain story stays on `*.vercel.app`.
- Payment / pricing. Free during this phase.
