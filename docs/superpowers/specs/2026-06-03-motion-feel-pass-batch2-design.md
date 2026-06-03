# Motion & Feel Pass — Batch 2 (remaining surfaces)

**Date:** 2026-06-03
**Status:** Design — approved in brainstorm, pending implementation
**Version target:** patch/minor bump (additive polish, no feature/data change)
**Builds on:** `2026-06-03-motion-feel-pass-design.md` (Batch 1, shipped v3.7.0)

## Goal

Extend the already-shipped CSS motion system (Batch 1) to the rest of the app's
surfaces, at the same restrained "balanced/chill" intensity. No new primitives,
no new dependencies — reuse `.skeleton`, `<Reveal>`, `.animate-fade-up`,
`.animate-scale-in` (all already in `app/globals.css` / `components/motion/`).

Route-level page transitions are already global (Batch 1's `<PageTransition>`
in `chrome-shell.tsx` wraps every page), so Batch 2 does NO per-page transition
work.

## Scope

### In scope
1. **Skeleton swaps** — replace all remaining Tailwind `animate-pulse` loader
   blocks (9 occurrences across 8 files) with the `.skeleton` shimmer.
2. **Signature moments:**
   - **Practice results** score card → `.animate-scale-in` (the moment deferred
     from Batch 1).
   - **Practice quiz** question card → `.animate-fade-up` between questions.
3. **Tasteful content reveals:**
   - **Tutor** chat bubbles → `.animate-fade-up` per message (NOT scroll-reveal —
     it would fight the auto-scroll); empty-state suggestion block fade-up.
   - **Diagrams** generated result → `.animate-fade-up` on first appearance.
   - **Practice dashboard** stat row + sections → staggered `<Reveal>`.
   - **Study Guides list** guide cards → staggered `<Reveal>`.
   - **Assignments** list rows → staggered `<Reveal>`.
   - **Study Guide view** + **Subject page** content wrappers → `.animate-fade-up`
     when the loaded content arrives.
   - **Notepad** → skeleton swap only (editor stays calm/interactive).

### Out of scope (YAGNI)
- Mobile-nav micro-transitions and the new-subject form (marginal; page-fade
  already covers them).
- Any new CSS primitives or JS components — Batch 2 is pure application.
- Feature/behavior/data/color changes. Diagram + tutor *logic* untouched (the
  separate sub-projects B and C own those).

## Design — per surface

All `.skeleton` swaps follow the same rule: replace
`... animate-pulse rounded-[Npx] bg-surface-2/60 ...` with
`skeleton rounded-[18px]` (keep height/grid/col classes; `.skeleton` provides
its own background).

| File | Edits |
|---|---|
| `app/practice/[quizId]/page.tsx` | L70 skeleton → `.skeleton`; `Results` score-card div (L315) gets `animate-scale-in`; `Taking` card (L220) gets `animate-fade-up` so advancing questions eases in |
| `app/tutor/page.tsx` | each message wrapper (user L157, assistant L163) gets `animate-fade-up`; empty-state block (L133) gets `animate-fade-up` |
| `app/diagrams/page.tsx` | result wrapper (L202) gets `animate-fade-up` |
| `app/practice/page.tsx` | L93 + L123 skeletons → `.skeleton`; wrap `StatsRow`/`ImprovementSection`/"Start a new quiz" section/`RecentAttempts` in staggered `<Reveal>` |
| `app/study-guides/page.tsx` | L57 skeleton → `.skeleton`; wrap each `GuideCard` in `<Reveal index={i}>` |
| `app/assignments/page.tsx` | L149 skeleton → `.skeleton`; wrap each list `AssignmentRow` in `<Reveal index={i}>` |
| `app/study-guides/[subjectId]/page.tsx` | L108 skeleton → `.skeleton`; content wrapper (L134) gets `animate-fade-up` |
| `app/subjects/[id]/page.tsx` | L224 skeleton → `.skeleton`; content wrapper (L253) gets `animate-fade-up` |
| `app/notepad/page.tsx` | L152 skeleton → `.skeleton` |

(Line numbers are anchors as of this writing; implementers match on the literal
code shown in the plan, not the line number.)

## Components / boundaries

No new units. Consumes existing:
- `.skeleton`, `.animate-fade-up`, `.animate-scale-in` (CSS, `app/globals.css`)
- `<Reveal>` (`components/motion/reveal.tsx`)

`<Reveal>` is imported into the four list/section pages (practice dashboard,
study-guides list, assignments). The per-message / per-card `animate-fade-up`
uses stable React keys so only newly-added elements animate (existing ones don't
re-animate on re-render).

## Accessibility

Unchanged from Batch 1 — global `prefers-reduced-motion` zeroes all of these
animations/transitions, and `<Reveal>` carries its own JS guard. No new concerns.

## Testing

- No new logic → no new unit tests. Existing 97 vitest tests must stay green.
- Verify: `npx tsc --noEmit` clean · `npx vitest run` green · `npx next build`
  succeeds.
- Live smoke on localhost: each surface's skeleton shimmers, lists/sections ease
  in, practice results scale in, tutor messages fade in, diagram result fades in;
  reduced-motion emulation shows instant behavior.

## Success criteria

- No `animate-pulse` loaders remain in `app/` (all shimmer).
- Practice results land with a scale-in; quiz questions ease between each other.
- Tutor replies and the diagram result fade in instead of popping.
- Practice dashboard, study-guides list, and assignments list ease in on load.
- No regressions: tsc clean, 97 tests green, build passes, no new deps.

## Follow-ups (separate, out of scope)

- Sub-project B: improve diagram illustration quality.
- Sub-project C: tutor opt-in diagrams + "Add diagram" suggested-action chips.
