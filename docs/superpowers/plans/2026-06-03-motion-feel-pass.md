# Motion & Feel Pass — Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calm-but-satisfying ("balanced" intensity) CSS motion layer to PufferStudy — page transitions, scroll reveals, a real 3D flashcard flip, tactile buttons/cards, and shimmer loading — without new dependencies or layout/feature/color changes.

**Architecture:** A single set of motion tokens (easing + duration CSS vars) plus reusable primitives: keyframe utility classes, a `<Reveal>` scroll-into-view wrapper, and a `<PageTransition>` route wrapper. The "spring" snap is a CSS `linear()` easing curve — no JS physics. The only testable logic (reveal guard) is extracted to a pure `lib/motion.ts` helper to fit the node-env test setup.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4 (CSS-first via `globals.css`), Vitest 2 (node env), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-03-motion-feel-pass-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `app/globals.css` | Motion tokens, keyframe utilities, `.skeleton`, `.reveal`, flip classes, button/card retune | Modify |
| `lib/motion.ts` | Pure reveal-guard + stagger helpers | Create |
| `lib/motion.test.ts` | Unit tests for the helpers | Create |
| `components/motion/reveal.tsx` | Scroll-into-view fade-up wrapper | Create |
| `components/motion/page-transition.tsx` | Route-change fade-up wrapper | Create |
| `components/chrome-shell.tsx` | Mount `<PageTransition>` around main content | Modify |
| `components/ui/button.tsx` | Retune press/hover easing to tokens | Modify |
| `app/page.tsx` | Staggered Study Desk reveal + skeleton swap | Modify |
| `app/flashcards/[deckId]/page.tsx` | 3D flip, skeleton swap, ready fade-in, completion scale-in | Modify |
| `app/flashcards/page.tsx` | Skeleton swap on list loaders | Modify |
| `package.json` | Version bump 3.6.0 → 3.7.0 | Modify |

---

### Task 1: Motion tokens + keyframe/utility CSS

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add motion tokens to the `@theme` block**

In `app/globals.css`, inside the existing `@theme { ... }` block (currently ends after `--font-mono`), add before its closing `}`:

```css
  /* Motion & feel pass: shared easing + duration tokens. */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-soft: cubic-bezier(0.65, 0, 0.35, 1);
  /* linear() approximation of a lightly-damped spring (single small overshoot). */
  --ease-spring: linear(
    0, 0.006, 0.025, 0.101, 0.539, 0.721, 0.849, 0.937, 0.991, 1.013,
    1.019, 1.016, 1.009, 1.003, 1
  );
  --dur-fast: 150ms;
  --dur-base: 280ms;
  --dur-slow: 460ms;
```

- [ ] **Step 2: Add keyframe utility classes**

At the END of `app/globals.css` (after the existing `.puffer-happy` reduced-motion block), append:

```css
/* ---- Motion & feel pass: reusable primitives ---- */

@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

.animate-fade-up {
  animation: fade-up var(--dur-base) var(--ease-out-soft) both;
  animation-delay: calc(var(--stagger-index, 0) * 60ms);
}
.animate-scale-in {
  animation: scale-in var(--dur-base) var(--ease-out-soft) both;
}
/* Page-transition entrance (slower than a normal fade-up). */
.animate-page-in {
  animation: fade-up var(--dur-slow) var(--ease-out-soft) both;
}

/* Scroll-into-view reveal: starts hidden, transitions in when JS adds --in. */
.reveal {
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity var(--dur-base) var(--ease-out-soft),
    transform var(--dur-base) var(--ease-out-soft);
  transition-delay: calc(var(--stagger-index, 0) * 60ms);
}
.reveal.reveal--in {
  opacity: 1;
  transform: none;
}

/* Calm shimmer skeleton — replaces Tailwind animate-pulse blocks.
   NOTE: gradient uses rgba literals, never color-mix() (minifier strips it). */
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--surface-2);
}
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.10),
    transparent
  );
  animation: skeleton-shimmer 1.6s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  100% { transform: translateX(100%); }
}

/* 3D flashcard flip. */
.flip-scene { perspective: 1200px; }
.flip-card {
  position: relative;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform var(--dur-base) var(--ease-spring);
}
.flip-card--flipped { transform: rotateY(180deg); }
.flip-face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.flip-face--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .reveal { transition: none; }
  .flip-card { transition: none; }
}
```

- [ ] **Step 3: Verify the build compiles the CSS**

Run: `npx next build`
Expected: build succeeds (no CSS parse errors). It's fine if you instead run `npx tsc --noEmit` here for speed; the full build runs in Task 10.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(motion): add motion tokens + keyframe/reveal/skeleton/flip CSS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure motion helper (`lib/motion.ts`) — TDD

**Files:**
- Create: `lib/motion.ts`
- Test: `lib/motion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/motion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shouldAnimate, staggerDelayMs } from "./motion";

describe("shouldAnimate", () => {
  it("animates when motion is allowed and IntersectionObserver exists", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: false, hasIntersectionObserver: true }),
    ).toBe(true);
  });

  it("does not animate when the user prefers reduced motion", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: true, hasIntersectionObserver: true }),
    ).toBe(false);
  });

  it("does not animate when IntersectionObserver is unavailable", () => {
    expect(
      shouldAnimate({ prefersReducedMotion: false, hasIntersectionObserver: false }),
    ).toBe(false);
  });
});

describe("staggerDelayMs", () => {
  it("returns 0 for the first item", () => {
    expect(staggerDelayMs(0)).toBe(0);
  });

  it("scales linearly with index using the default step", () => {
    expect(staggerDelayMs(3)).toBe(180);
  });

  it("respects a custom step", () => {
    expect(staggerDelayMs(2, 100)).toBe(200);
  });

  it("clamps negative indices to 0", () => {
    expect(staggerDelayMs(-5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/motion.test.ts`
Expected: FAIL — `Cannot find module './motion'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/motion.ts`:

```ts
/**
 * Pure helpers for the motion layer. Kept dependency-free and DOM-free so they
 * run under Vitest's node environment (the project has no DOM test harness).
 */

/** Whether scroll/IO-driven animations should run. */
export function shouldAnimate(opts: {
  prefersReducedMotion: boolean;
  hasIntersectionObserver: boolean;
}): boolean {
  return !opts.prefersReducedMotion && opts.hasIntersectionObserver;
}

/** Stagger delay (ms) for a 0-based index; negative indices clamp to 0. */
export function staggerDelayMs(index: number, stepMs = 60): number {
  return Math.max(0, index) * stepMs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/motion.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/motion.ts lib/motion.test.ts
git commit -m "feat(motion): pure shouldAnimate + staggerDelayMs helpers with tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `<Reveal>` component

**Files:**
- Create: `components/motion/reveal.tsx`

- [ ] **Step 1: Create the component**

Create `components/motion/reveal.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { shouldAnimate } from "@/lib/motion";

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger position; multiplies the per-item delay. */
  index?: number;
}

/**
 * Fades its children up when first scrolled into view. Renders hidden via the
 * `.reveal` class and adds `.reveal--in` on intersection. Falls back to showing
 * content immediately when reduced-motion is on or IntersectionObserver is
 * missing. JS is required for the reveal — acceptable in this fully-client app.
 */
export function Reveal({ index = 0, className, children, style, ...rest }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const active = shouldAnimate({
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      hasIntersectionObserver: "IntersectionObserver" in window,
    });

    if (!active) {
      el.classList.add("reveal--in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("reveal--in");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={index ? ({ "--stagger-index": index, ...style } as React.CSSProperties) : style}
      {...rest}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/motion/reveal.tsx
git commit -m "feat(motion): Reveal scroll-into-view wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `<PageTransition>` + mount in chrome-shell

**Files:**
- Create: `components/motion/page-transition.tsx`
- Modify: `components/chrome-shell.tsx`

- [ ] **Step 1: Create the component**

Create `components/motion/page-transition.tsx`:

```tsx
"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Gently fades the main content up on each route change. Keyed on pathname so a
 * navigation remounts the wrapper and replays `.animate-page-in`. Reduced-motion
 * is handled globally (the @media rule zeroes animation duration → instant).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Mount it around the main content in `chrome-shell.tsx`**

In `components/chrome-shell.tsx`, add the import after the existing imports (after line 8):

```tsx
import { PageTransition } from "@/components/motion/page-transition";
```

Then change the `<main>` line (currently `<main className="flex-1">{children}</main>`) to:

```tsx
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
```

Leave the auth-route and wallpaper-mode branches untouched (no page transition there).

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/motion/page-transition.tsx components/chrome-shell.tsx
git commit -m "feat(motion): fade pages in on route change via PageTransition

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Retune buttons + cards to motion tokens

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Retune the button base classes**

In `components/ui/button.tsx`, in the `cva(...)` base string (line 7), replace this fragment:

```
transition-all duration-150
```

with:

```
transition-all duration-[var(--dur-fast)] ease-[var(--ease-spring)]
```

Keep everything else on that line (including `active:scale-[0.98]`) unchanged.

- [ ] **Step 2: Retune `.glow-card` transition + add a subtle press**

In `app/globals.css`, in the `.glow-card` rule, replace the existing `transition` declaration:

```css
    transition: box-shadow 240ms ease, border-color 240ms ease, transform 220ms ease;
```

with:

```css
    transition:
      box-shadow var(--dur-base) var(--ease-out-soft),
      border-color var(--dur-base) var(--ease-out-soft),
      transform var(--dur-base) var(--ease-spring);
```

Then, immediately AFTER the closing `}` of the `.glow-card:hover` rule, add:

```css
  .glow-card:active {
    transform: translateY(-1px) scale(0.995);
  }
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Tailwind arbitrary `ease-[var(--ease-spring)]` is valid utility syntax; full CSS is validated in Task 10's build.)

- [ ] **Step 4: Commit**

```bash
git add components/ui/button.tsx app/globals.css
git commit -m "feat(motion): tactile button press + card token retune

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Study Desk staggered reveal + skeleton swap

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Import `Reveal`**

In `app/page.tsx`, add after the existing component imports (after line 11, `import { SubjectsGrid } ...`):

```tsx
import { Reveal } from "@/components/motion/reveal";
```

- [ ] **Step 2: Swap the loading skeleton blocks to shimmer**

Replace the not-ready block (lines 69-73):

```tsx
      {!ready ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-1" />
          <div className="h-[400px] animate-pulse bg-surface-2/60 lg:col-span-2" />
        </div>
      ) : (
```

with:

```tsx
      {!ready ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <div className="skeleton h-[400px] rounded-[18px] lg:col-span-1" />
          <div className="skeleton h-[400px] rounded-[18px] lg:col-span-2" />
        </div>
      ) : (
```

- [ ] **Step 3: Wrap the dashboard panels in staggered `<Reveal>`**

Replace the ready block's inner content (the `<aside>` and `<section>` currently at lines 76-88) so each panel reveals with a stagger. The ready block becomes:

```tsx
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-span-1 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <Reveal index={0}>
              <TodayPanel subjects={items} assignments={assignments ?? []} />
            </Reveal>
            <Reveal index={1}>
              <ActivityFeed />
            </Reveal>
          </aside>
          <section className="flex flex-col gap-4 lg:col-span-2">
            <Reveal index={1}>
              <UpcomingTimeline subjects={items} assignments={assignments ?? []} />
            </Reveal>
            <Reveal index={2}>
              <SubjectsGrid
                subjects={items}
                onSubjectsChange={(updater) =>
                  setSubjects((prev) => (prev ? updater(prev) : prev))
                }
              />
            </Reveal>
          </section>
        </div>
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(motion): staggered Study Desk reveal + shimmer skeletons

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Flashcard 3D flip + skeleton + ready fade-in + completion scale-in

**Files:**
- Modify: `app/flashcards/[deckId]/page.tsx`

- [ ] **Step 1: Swap the deck loading skeleton to shimmer**

In `app/flashcards/[deckId]/page.tsx`, replace the loading block (line 72):

```tsx
        <div className="h-64 animate-pulse rounded-[14px] bg-surface-2/60" />
```

with:

```tsx
        <div className="skeleton h-64 rounded-[18px]" />
```

- [ ] **Step 2: Fade the ready content in**

Change the outer wrapper of the main ready return (line 114) from:

```tsx
    <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-12">
```

to:

```tsx
    <div className="animate-fade-up mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-12">
```

- [ ] **Step 3: Rewrite `StudyCard` to use the 3D flip**

Replace the entire `StudyCard` function (lines 161-211) with:

```tsx
function StudyCard({
  card,
  flipped,
  onFlip,
  onGrade,
}: {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  onGrade: (g: ReviewGrade) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Show front" : "Reveal answer"}
        className="flip-scene w-full"
      >
        <div className={`flip-card ${flipped ? "flip-card--flipped" : ""}`}>
          {/* Front face */}
          <div className="flip-face glow-card flex min-h-[260px] w-full flex-col items-center justify-center border border-default bg-surface p-8 text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Front
            </p>
            <p
              className="mt-4 text-[1.4rem] leading-tight text-ink"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {card.front}
            </p>
            <p className="mt-6 text-[12px] text-ink-faint">Click anywhere to reveal</p>
          </div>
          {/* Back face */}
          <div className="flip-face flip-face--back glow-card flex min-h-[260px] w-full flex-col items-center justify-center border border-default bg-surface p-8 text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Back
            </p>
            <p
              className="mt-4 text-[1.4rem] leading-tight text-ink"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {card.back}
            </p>
          </div>
        </div>
      </button>

      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="danger" onClick={() => onGrade("again")}>
            Again
          </Button>
          <Button variant="secondary" onClick={() => onGrade("good")}>
            Good
          </Button>
          <Button onClick={() => onGrade("easy")}>Easy</Button>
        </div>
      ) : (
        <Button size="lg" onClick={onFlip} className="w-full">
          Reveal answer
        </Button>
      )}
    </div>
  );
}
```

Note: both faces always render (that's how a CSS flip works); `backface-visibility: hidden` hides whichever is turned away. The hover `bg-surface-2/40` was dropped because it would only tint one face — the glow-card hover lift/glow remains.

- [ ] **Step 4: Give the completion screen a scale-in entrance**

In `SessionComplete` (line 229), change the root div from:

```tsx
    <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
```

to:

```tsx
    <div className="animate-scale-in glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
```

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual check (live)**

Run the dev server if not running (`npm run dev`), open `http://localhost:3000/flashcards`, enter a deck, and confirm: card performs a 3D flip on click, both front/back read correctly (back not mirrored), grade buttons work, completion screen scales in. Toggle DevTools "Emulate prefers-reduced-motion" and confirm the flip is instant.

- [ ] **Step 7: Commit**

```bash
git add "app/flashcards/[deckId]/page.tsx"
git commit -m "feat(motion): real 3D flashcard flip + shimmer + scale-in completion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Flashcards list skeleton swap

**Files:**
- Modify: `app/flashcards/page.tsx`

- [ ] **Step 1: Swap the two list skeleton blocks to shimmer**

In `app/flashcards/page.tsx`, replace the loader at line 105:

```tsx
            <div key={i} className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
```

with:

```tsx
            <div key={i} className="skeleton h-32 rounded-[18px]" />
```

And replace the loader at line 133:

```tsx
          <div className="h-24 animate-pulse rounded-[14px] bg-surface-2/60" />
```

with:

```tsx
          <div className="skeleton h-24 rounded-[18px]" />
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/flashcards/page.tsx
git commit -m "feat(motion): shimmer skeletons on flashcards list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Tests**

Run: `npx vitest run`
Expected: all tests pass — the prior 90 plus the 7 new `lib/motion.test.ts` cases (97 total).

- [ ] **Step 3: Production build**

Run: `npx next build`
Expected: build succeeds with no CSS or type errors.

- [ ] **Step 4: Live smoke test on localhost:3000**

Confirm across a couple of pages: route navigation fades up; Study Desk panels stagger in on load; flashcard flips in 3D; loaders shimmer; buttons/cards feel tactile on press. Spot-check a reduced-motion run (DevTools emulation) shows instant, non-animated behavior everywhere.

---

### Task 10: Version bump + ship to prod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump the version**

In `package.json`, change `"version": "3.6.0"` to `"version": "3.7.0"`.

- [ ] **Step 2: Commit + tag**

```bash
git add package.json
git commit -m "chore: bump version to 3.7.0 (motion & feel pass batch 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag -a v3.7.0 -m "Motion & feel pass — Batch 1"
```

- [ ] **Step 3: Push to main (Vercel auto-deploys to prod)**

```bash
git push origin main --follow-tags
```

- [ ] **Step 4: Fire the `[SHIPPED]` Telegram ping**

Per the user's ship-ping preference, run the project's notify command with a `[SHIPPED]` message noting v3.7.0 motion & feel pass is live. (See `~/.claude/bin/telegram-notify.sh`.) If the ping fails (e.g. network/Zscaler), note it and continue — it is non-blocking.

---

## Self-Review

**Spec coverage:**
- Motion tokens → Task 1 ✓
- Keyframe utilities (`.animate-fade-up`, `.animate-scale-in`, `.skeleton`) → Task 1 ✓
- `<Reveal>` (with reduced-motion / no-IO guard) → Tasks 2–3 ✓
- `<PageTransition>` mounted in chrome-shell → Task 4 ✓
- Buttons retune → Task 5 ✓
- Cards (`.glow-card`) retune + press → Task 5 ✓
- Study Desk staggered reveal → Task 6 ✓
- Flashcard 3D flip → Task 7 ✓
- AI-loading skeletons (flashcards list + deck) → Tasks 7–8 ✓
- Content fade-in on load → Task 7 (deck ready) + Task 6 (skeleton→reveal) ✓
- Completion scale-in (Flashcard SessionComplete) → Task 7 ✓
- Accessibility (reduced-motion) → Task 1 CSS guards + Task 3 JS guard ✓
- Testing (pure helper unit tests + live verification) → Tasks 2, 9 ✓
- **Deviation from spec (intentional, noted to user):** Practice-results scale-in deferred to Batch 2 (practice surface already out of scope); spec's success-feedback item is satisfied by the Flashcard completion screen for Batch 1.

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `shouldAnimate` / `staggerDelayMs` signatures match between `lib/motion.ts`, `lib/motion.test.ts`, and `reveal.tsx`. `Reveal` props (`index`, standard div attrs) match its usage in `app/page.tsx`. CSS class names (`reveal`, `reveal--in`, `flip-card`, `flip-card--flipped`, `flip-face`, `flip-face--back`, `skeleton`, `animate-fade-up`, `animate-scale-in`, `animate-page-in`) are defined in Task 1 and referenced consistently thereafter. ✓
