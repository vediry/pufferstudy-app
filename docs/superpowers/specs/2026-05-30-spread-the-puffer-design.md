# Spread the Puffer — Design

**Date:** 2026-05-30
**Status:** Approved, ready for planning
**Builds on:** Cozy redesign (`80ca2dd`), which introduced `components/puffer.tsx` and the mascot in `DashboardEmptyState`.

## Goal

Make the PufferStudy mascot a consistent presence across the app's empty and
celebration states, matching the cozy redesign. Today the puffer appears in
exactly one place (`DashboardEmptyState`). Every other empty state and the two
"you finished" screens show a generic lucide icon in a bordered box instead.

No new art assets. The single existing `public/puffer.png` is reused everywhere;
celebration screens give it a gentle happy animation.

## Scope

Six surfaces, plus the shared `Puffer` component.

### Empty states — replace icon-box with a calm Puffer

Each of these currently renders a small `h-12 w-12` lucide icon inside a rounded
bordered box above a serif heading, muted paragraph, and button(s). Replace the
icon-box entirely with `<Puffer size={96} />` (calm `idle` pose). Heading, text,
and buttons are unchanged.

1. **Flashcards list** — `app/flashcards/page.tsx` (`EmptyState`, "No subjects yet", currently `Layers` icon)
2. **Practice dashboard** — `app/practice/page.tsx` (empty branch, "No cheat sheets ready" / "No subjects yet")
3. **Study-guides list** — `app/study-guides/page.tsx` ("No subjects yet")
4. **Notepad** — `app/notepad/page.tsx` ("Your notepad is empty")

`DashboardEmptyState` (`components/empty-state.tsx`) already shows a calm puffer
(`size={128}` in a larger `py-16` container) and is the reference for the *idiom*
the four above adopt — calm `idle` puffer in place of the icon-box. The four list
empty states use `size={96}` to fit their smaller `py-12` containers; they do not
need to match the dashboard's exact size. `DashboardEmptyState` itself does not change.

### Celebration screens — replace icon-box with a happy Puffer

Both currently render a `PartyPopper` icon-box. Replace with
`<Puffer size={112} mood="happy" />`.

5. **Flashcard session complete** — `SessionComplete` in `app/flashcards/[deckId]/page.tsx`
6. **Practice quiz results** — the `done` view in `app/practice/[quizId]/page.tsx`

## Component changes — `components/puffer.tsx`

The `mood` prop is currently cosmetic (both values render the same static image).
Wire it up:

- `mood="happy"` adds a CSS class producing a gentle bounce/wiggle and a soft
  accent-colored glow halo behind the mascot. `mood="idle"` renders exactly as
  today (no motion, no halo).
- The animation respects `prefers-reduced-motion: reduce` — no bounce/wiggle for
  users who opt out (consistent with how the aurora background already guards
  motion). The static image + halo still render; only the movement is dropped.
- The happy class wraps both the `<img>` path and the `PufferFallback` inline-SVG
  path, so the animation works even when the PNG fails to load.

The animation keyframes live in `app/globals.css` alongside the other cozy-redesign
animations, keyed by a class the component applies (e.g. `.puffer-happy`).

## Out of scope (YAGNI)

- No second/alternate art asset.
- No per-subject or randomized mascots.
- No loading-state or error-state puffers.
- No changes to settings, landing, app-bar, or any non-empty/non-celebration surface.

## Success criteria

- All six surfaces render the puffer in place of the former lucide icon-box.
- The two celebration screens animate (bounce + halo) when motion is allowed, and
  render static when `prefers-reduced-motion` is set.
- Build, typecheck, and the existing test suite stay green.
- Visual check on localhost across at least one light theme (Latte) and one dark
  theme (Cocoa) confirms the mascot reads well on both.
