# Motion & Feel Pass — Batch 1 (CSS-first)

**Date:** 2026-06-03
**Status:** Design — approved in brainstorm, pending spec review
**Version target:** minor bump (motion is additive polish, no feature/data change)

## Goal

Make PufferStudy feel **smooth, calm, and satisfying** to use. The cozy redesign
already nailed the *static* look (warm themes, aurora cove lighting, glow cards,
soft shadows). This pass adds the **motion layer on top** — how things move and
respond — without changing layout, features, colors, or data.

Intensity is **Balanced**: a calm base with a satisfying snap where it counts
(button press, card flip, success moments). Chill overall, but interactions
reward you. Not whisper-quiet, not playful/bouncy.

This is **Batch 1** of a larger feel pass. It builds the shared motion system
once, then applies it to the highest-impact surfaces. Later batches extend the
same primitives to the remaining pages — by design, those become near one-liners.

## Scope

### In scope (Batch 1)
- A shared **motion foundation**: easing + duration tokens in `globals.css`.
- Three reusable **primitives**: keyframe utility classes, a `<Reveal>` component,
  a `<PageTransition>` wrapper.
- Application to flagship surfaces:
  - Global **buttons** and **cards** (touches every page).
  - **Page transitions** on route change.
  - **Study Desk** entrance (staggered panel reveal).
  - **Flashcard flip** — a real 3D flip (signature interaction).
  - **AI-loading skeletons** (shimmer) + **content fade-in** + gentle
    **completion-screen** entrance.

### Out of scope (later batches — not this spec)
- Notepad, Assignments, Guides, Practice take view, Tutor, Diagrams,
  Subjects pages, mobile-nav transitions.
- Any Framer Motion / JS physics library. (Approach chosen: CSS-first.)
- Sound design. Color/theme/layout/feature changes.
- The separate queued sub-projects: **(B)** better diagram illustrations,
  **(C)** tutor opt-in diagrams + suggested-action chips. Tracked separately.

## Approach

**CSS-first.** No new dependencies. The app already does all motion in CSS;
this stays consistent, keeps the bundle tiny (lightness itself reads as
"smooth"), and works with the App Router's Server Components. The "spring" snap
is achieved with a CSS `linear()` easing curve — no JS physics engine. The only
JS is two small client components (`<Reveal>`, `<PageTransition>`) that need
browser APIs (IntersectionObserver, `usePathname`).

## Design

### 1. Motion tokens (`app/globals.css`, in `@theme` / `:root`)

```
Easing
  --ease-out-soft     cubic-bezier(0.22, 1, 0.36, 1)    calm entrances / reveals
  --ease-spring       linear(...) gentle overshoot       satisfying snap (press, flip)
  --ease-in-out-soft  cubic-bezier(0.65, 0, 0.35, 1)     two-way transitions
Duration
  --dur-fast          150ms    press / hover feedback
  --dur-base          280ms    entrances, reveals, flip
  --dur-slow          460ms    page transitions, big fades
```

`--ease-spring` is a `linear()` easing approximation of a lightly-damped spring
(small single overshoot, settles quickly). Tune the overshoot live on localhost
to taste — start subtle.

### 2. Primitives

**a. Keyframe utilities** (`globals.css`)
- `.animate-fade-up` — `opacity 0→1` + `translateY(8px→0)`, `--dur-base` `--ease-out-soft`.
- `.animate-scale-in` — `opacity 0→1` + `scale(0.96→1)`, `--dur-base` `--ease-out-soft`.
- `.skeleton` — soft gradient **shimmer sweep** across `var(--surface-2)`; replaces
  Tailwind `animate-pulse` blocks. Uses a moving `background-position` on a
  three-stop gradient (NOT `color-mix()` inside the gradient — see Gotchas).
- Stagger: a `--stagger-index` custom property drives
  `animation-delay: calc(var(--stagger-index) * 60ms)`.

**b. `<Reveal>`** (`components/motion/reveal.tsx`, client)
- Wraps children; uses `IntersectionObserver` to add `.animate-fade-up` when the
  element first enters the viewport. `once` (default true).
- Props: `children`, `delay`/`index` (for stagger), `as` (element tag, default `div`).
- Guards: if `matchMedia('(prefers-reduced-motion: reduce)').matches` OR
  `IntersectionObserver` is undefined → render children visible immediately, no observer.
- To avoid a flash-of-hidden-then-animate, initial hidden state is applied only
  when the component is active (motion allowed + observer available).

**c. `<PageTransition>`** (`components/motion/page-transition.tsx`, client)
- Wraps the main content slot. Reads `usePathname()`; on pathname change,
  re-mounts/re-keys children so `.animate-fade-up` replays — a gentle fade-up
  between routes.
- Mounted once inside `components/chrome-shell.tsx` around the `<main>` children
  (NOT around AppBar/Sidebar/MobileNav — chrome stays put). Auth-route branch
  unchanged.
- Reduced-motion guard: no-op wrapper (render children plainly).

### 3. Surface application

**Global buttons** (`components/ui/button.tsx`)
- Keep `active:scale-[0.98]`. Retune transition to `--dur-fast` + `--ease-spring`
  so the press snaps back satisfyingly. Hover uses `--ease-out-soft`. No structural change.

**Cards** (`.glow-card` in `globals.css`)
- Re-point its existing `transition` to the motion tokens. Add a faint
  press-scale (`active:scale-[0.99]` equivalent) for clickable cards, layered
  under the existing hover glow/lift. Keep the glow exactly as-is.

**Page transitions**
- Via `<PageTransition>` above. Every route navigation fades up instead of hard-cutting.

**Study Desk entrance** (`app/page.tsx`)
- Wrap TodayPanel · ActivityFeed · UpcomingTimeline · SubjectsGrid in `<Reveal>`
  with incrementing stagger indices so the dashboard assembles top-to-bottom on load.

**Flashcard flip** (`app/flashcards/[deckId]/page.tsx`)
- Replace the current text-swap (`{flipped ? card.back : card.front}` with
  `transition-colors`) with a real **3D flip**:
  - Outer `.flip` container: `perspective`.
  - Inner: `transform-style: preserve-3d`, `transition: transform --dur-base --ease-spring`,
    `rotateY(180deg)` when `flipped`.
  - Two faces (front/back), each `backface-visibility: hidden`; back pre-rotated `rotateY(180deg)`.
- Preserve all existing behavior: click anywhere to flip, `flipped` state,
  aria-label, the "Reveal answer" button, grade buttons on the back.
- Reduced-motion → instant swap (no rotation), matching today's UX.

**AI-loading & success feedback**
- Replace `animate-pulse` skeleton blocks in `app/flashcards/page.tsx` and
  `app/flashcards/[deckId]/page.tsx` with the `.skeleton` shimmer class.
- When generated/loaded content replaces a skeleton, `.animate-fade-up` it in.
- Completion screens (Flashcard `SessionComplete`, Practice results) — already
  render the happy puffer — get an `.animate-scale-in` entrance. No confetti.
- Generate-button `Loader2` spinners stay as-is.

## Components / boundaries

| Unit | Purpose | Depends on |
|---|---|---|
| Motion tokens (CSS vars) | Single source of easing/duration | none |
| Keyframe utilities (`.animate-*`, `.skeleton`) | Declarative one-class animations | tokens |
| `<Reveal>` | Scroll-into-view fade-up, reduced-motion safe | IntersectionObserver, matchMedia |
| `<PageTransition>` | Route-change fade-up | usePathname |
| Surface edits | Apply primitives to buttons/cards/desk/flashcards/loaders | all of the above |

Each primitive is independently understandable and usable; surfaces consume them
through class names / wrappers, so internals can change without breaking callers.

## Accessibility

- Global `@media (prefers-reduced-motion: reduce)` already zeroes animation/
  transition durations — existing behavior preserved.
- `<Reveal>` and `<PageTransition>` additionally guard with `matchMedia` so they
  render content visible immediately (no hidden-state lock-in) for reduced-motion users.
- Flip degrades to instant swap. Focus rings, keyboard activation, and aria
  labels unchanged.

## Testing

- **Unit:** `<Reveal>` — mock `IntersectionObserver` + `matchMedia`; assert it
  (a) adds the reveal class when intersecting, (b) renders children visible and
  attaches no observer under reduced-motion / missing-observer.
- **Visual:** verify live on `localhost:3000` — page transitions, Study Desk
  stagger, flashcard 3D flip, skeleton shimmer, completion entrance; spot-check a
  reduced-motion run (DevTools emulate) shows instant behavior.
- **Gates before ship:** `npx tsc --noEmit` clean · `npx vitest run` all green
  (90 existing + new Reveal test) · `npx next build` succeeds.

## Gotchas (from prior sessions — still apply)

- Do NOT use `color-mix()` inside gradient color stops — Next's CSS minifier
  strips it in prod. Build the `.skeleton` shimmer gradient with explicit
  rgba/var stops or pre-mixed CSS variables.
- `body` already has `isolation: isolate`; don't disturb the aurora pseudo-element
  stacking when adding page-transition wrappers.
- Keep chrome (AppBar/Sidebar/MobileNav) outside the page-transition wrapper so
  it doesn't fade on every navigation.

## Success criteria

- Navigating between pages fades rather than hard-cuts.
- The Study Desk assembles with a gentle staggered reveal on load.
- Flashcards perform a real 3D flip that feels satisfying (balanced, not bouncy).
- AI-generation areas show a calm shimmer, and results fade in rather than pop.
- Buttons/cards feel tactile on press.
- Reduced-motion users see today's instant experience.
- No regressions: tsc clean, all tests green, build passes, bundle essentially
  unchanged (no new deps).

## Follow-ups (out of scope, tracked)

- Batch 2+: extend `<Reveal>` / `.skeleton` / page transition to remaining pages.
- Sub-project B: improve diagram illustration quality.
- Sub-project C: tutor opt-in diagrams + "Add diagram" suggested-action chips.
