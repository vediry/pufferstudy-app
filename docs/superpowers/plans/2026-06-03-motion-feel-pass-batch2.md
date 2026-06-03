# Motion & Feel Pass — Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the already-shipped motion primitives (`.skeleton`, `<Reveal>`, `.animate-fade-up`, `.animate-scale-in`) to the remaining app surfaces at the same balanced/chill intensity. No new primitives, no new deps.

**Architecture:** Pure application of existing CSS classes + the `<Reveal>` component. Route transitions are already global (`<PageTransition>`), so no per-page transition work. Skeleton swaps + tasteful content reveals + two signature moments (Practice results scale-in, quiz-question fade-up).

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, TypeScript, Vitest 2 (node).

**Spec:** `docs/superpowers/specs/2026-06-03-motion-feel-pass-batch2-design.md`

**Skeleton-swap rule:** replace `... animate-pulse rounded-[Npx] bg-surface-2/60 ...` with `skeleton rounded-[18px]` (keep all height/grid/col/`key` classes; `.skeleton` supplies its own background).

---

### Task 1: Swap all remaining `animate-pulse` loaders to `.skeleton`

**Files:** `app/assignments/page.tsx`, `app/notepad/page.tsx`, `app/practice/[quizId]/page.tsx`, `app/study-guides/page.tsx`, `app/practice/page.tsx`, `app/subjects/[id]/page.tsx`, `app/study-guides/[subjectId]/page.tsx`

- [ ] **Step 1: Apply each replacement** (exact string → exact string)

`app/assignments/page.tsx`:
```
<div key={i} className="h-16 animate-pulse rounded-[12px] bg-surface-2/60" />
```
→
```
<div key={i} className="skeleton h-16 rounded-[18px]" />
```

`app/notepad/page.tsx`:
```
<div key={i} className="h-12 animate-pulse rounded-[10px] bg-surface-2/60" />
```
→
```
<div key={i} className="skeleton h-12 rounded-[18px]" />
```

`app/practice/[quizId]/page.tsx`:
```
<div className="h-64 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div className="skeleton h-64 rounded-[18px]" />
```

`app/study-guides/page.tsx`:
```
<div key={i} className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div key={i} className="skeleton h-32 rounded-[18px]" />
```

`app/practice/page.tsx` — TWO replacements:
```
<div className="h-24 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div className="skeleton h-24 rounded-[18px]" />
```
and
```
<div key={i} className="h-24 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div key={i} className="skeleton h-24 rounded-[18px]" />
```

`app/subjects/[id]/page.tsx`:
```
<div className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div className="skeleton h-32 rounded-[18px]" />
```

`app/study-guides/[subjectId]/page.tsx`:
```
<div className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
```
→
```
<div className="skeleton h-32 rounded-[18px]" />
```

- [ ] **Step 2: Confirm none remain**

Run: `grep -rn "animate-pulse" app/` → Expected: NO matches under `app/` except the comment in `app/globals.css` (which is not under `app/`-pages; if it appears, it's only the globals.css comment line — that's fine).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add app/assignments/page.tsx app/notepad/page.tsx "app/practice/[quizId]/page.tsx" app/study-guides/page.tsx app/practice/page.tsx "app/subjects/[id]/page.tsx" "app/study-guides/[subjectId]/page.tsx"
git commit -m "feat(motion): shimmer skeletons across remaining surfaces

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Practice quiz — results scale-in + question fade-up

**Files:** `app/practice/[quizId]/page.tsx`

- [ ] **Step 1: Results score card → scale-in**

Find (inside the `Results` function — note the unique `px-6 py-10`):
```tsx
      <div className="glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-10 text-center">
```
Replace with:
```tsx
      <div className="animate-scale-in glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-10 text-center">
```

- [ ] **Step 2: Question card → fade-up between questions**

In the `Taking` function, find:
```tsx
      <div className="glow-card border border-default bg-surface p-6">
```
Replace with (the `key={index}` remounts the card per question so the animation replays; `index` is already a prop of `Taking`):
```tsx
      <div key={index} className="animate-fade-up glow-card border border-default bg-surface p-6">
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/practice/[quizId]/page.tsx"
git commit -m "feat(motion): practice results scale-in + per-question fade-up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Tutor — per-message + empty-state fade-up

**Files:** `app/tutor/page.tsx`

- [ ] **Step 1: Empty-state block fade-up**

Find:
```tsx
          <div className="m-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
```
Replace with:
```tsx
          <div className="animate-fade-up m-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
```

- [ ] **Step 2: User message bubble fade-up**

Find:
```tsx
            <div key={i} className="flex justify-end">
```
Replace with:
```tsx
            <div key={i} className="animate-fade-up flex justify-end">
```

- [ ] **Step 3: Assistant message bubble fade-up**

Find:
```tsx
            <div key={i} className="flex items-start gap-2">
```
Replace with:
```tsx
            <div key={i} className="animate-fade-up flex items-start gap-2">
```

(Stable `key={i}` means only newly-added bubbles animate; existing ones don't re-animate on re-render.)

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add app/tutor/page.tsx
git commit -m "feat(motion): tutor messages + empty state fade in

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Diagrams — result fade-up

**Files:** `app/diagrams/page.tsx`

- [ ] **Step 1: Result wrapper fade-up**

Find:
```tsx
        <div className="mt-6 flex flex-col gap-3">
```
Replace with:
```tsx
        <div className="animate-fade-up mt-6 flex flex-col gap-3">
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add app/diagrams/page.tsx
git commit -m "feat(motion): fade the generated diagram in

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Staggered reveals on list/section pages

**Files:** `app/practice/page.tsx`, `app/study-guides/page.tsx`, `app/assignments/page.tsx`

- [ ] **Step 1: Practice dashboard — import Reveal + wrap sections**

In `app/practice/page.tsx`, add after the last existing import:
```tsx
import { Reveal } from "@/components/motion/reveal";
```

Then find this block:
```tsx
      <StatsRow stats={stats} />

      {stats && stats.weakest.length > 0 ? (
        <ImprovementSection stats={stats} />
      ) : null}
```
Replace with:
```tsx
      <Reveal index={0}>
        <StatsRow stats={stats} />
      </Reveal>

      {stats && stats.weakest.length > 0 ? (
        <Reveal index={1}>
          <ImprovementSection stats={stats} />
        </Reveal>
      ) : null}
```

Next, wrap the "Start a new quiz" `<section>` (the one beginning
`<section className="mb-8 flex flex-col gap-3">` whose `<h2>` reads "Start a new
quiz") in a Reveal — put `<Reveal index={2}>` immediately before that `<section>`
and `</Reveal>` immediately after its closing `</section>`. Do not change the
section's inner content.

Finally find:
```tsx
      {stats && stats.recent.length > 0 ? (
        <RecentAttempts stats={stats} refresh={refreshStats} />
      ) : null}
```
Replace with:
```tsx
      {stats && stats.recent.length > 0 ? (
        <Reveal index={3}>
          <RecentAttempts stats={stats} refresh={refreshStats} />
        </Reveal>
      ) : null}
```

- [ ] **Step 2: Study Guides list — import Reveal + wrap cards**

In `app/study-guides/page.tsx`, add after the last existing import:
```tsx
import { Reveal } from "@/components/motion/reveal";
```
Find:
```tsx
                {withGuide.map((s) => (
                  <GuideCard key={s.id} subject={s} />
                ))}
```
Replace with:
```tsx
                {withGuide.map((s, i) => (
                  <Reveal key={s.id} index={i}>
                    <GuideCard subject={s} />
                  </Reveal>
                ))}
```

- [ ] **Step 3: Assignments — import Reveal + wrap rows**

In `app/assignments/page.tsx`, add after the last existing import:
```tsx
import { Reveal } from "@/components/motion/reveal";
```
Find:
```tsx
          {filtered.map((a) => (
            <li key={a.id}>
              <AssignmentRow
                assignment={a}
                onStatus={(next) => handleStatus(a, next)}
                onDelete={() => handleDelete(a.id)}
              />
            </li>
          ))}
```
Replace with:
```tsx
          {filtered.map((a, i) => (
            <li key={a.id}>
              <Reveal index={i}>
                <AssignmentRow
                  assignment={a}
                  onStatus={(next) => handleStatus(a, next)}
                  onDelete={() => handleDelete(a.id)}
                />
              </Reveal>
            </li>
          ))}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add app/practice/page.tsx app/study-guides/page.tsx app/assignments/page.tsx
git commit -m "feat(motion): staggered reveals on practice/guides/assignments lists

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Detail-page content fade-ups

**Files:** `app/study-guides/[subjectId]/page.tsx`, `app/subjects/[id]/page.tsx`

These pages have a loading-branch wrapper AND a main-content wrapper. Target ONLY the main-content wrapper (identified by the following `<div className="no-print">` line).

- [ ] **Step 1: Study guide view content wrapper**

In `app/study-guides/[subjectId]/page.tsx`, find (two lines):
```tsx
    <div className="mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
```
Replace with:
```tsx
    <div className="animate-fade-up mx-auto w-full max-w-[1080px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
```

- [ ] **Step 2: Subject page content wrapper**

In `app/subjects/[id]/page.tsx`, find (two lines — this disambiguates from the identical loading-branch wrapper, which is NOT followed by `no-print`):
```tsx
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
```
Replace with:
```tsx
    <div className="animate-fade-up mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="no-print">
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` → no errors.
```bash
git add "app/study-guides/[subjectId]/page.tsx" "app/subjects/[id]/page.tsx"
git commit -m "feat(motion): fade in study-guide + subject content on load

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Verify + ship to prod

**Files:** `package.json`

- [ ] **Step 1: Verify gate**

Run: `npx tsc --noEmit` → no errors.
Run: `npx vitest run` → all 97 tests pass (no new tests this batch).
Run: `npx next build` → succeeds.
Run: `grep -rn "animate-pulse" app/` → only the `globals.css` comment, no page loaders.

- [ ] **Step 2: Live smoke on localhost:3000**

Spot-check: practice dashboard sections ease in; a quiz's questions ease between each other and the results card scales in; tutor reply fades in; a generated diagram fades in; study-guides + assignments lists ease in; all loaders shimmer. Emulate reduced-motion → instant behavior.

- [ ] **Step 3: Version bump + commit + tag**

In `package.json` change `"version": "3.7.0"` to `"version": "3.7.1"`.
```bash
git add package.json
git commit -m "chore: bump version to 3.7.1 (motion & feel pass batch 2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag -a v3.7.1 -m "Motion & feel pass — Batch 2"
```

- [ ] **Step 4: Merge to main + push (Vercel auto-deploys)**

```bash
git checkout main
git merge --ff-only feat/motion-batch2
git push origin main --follow-tags
```

- [ ] **Step 5: `[SHIPPED]` Telegram ping** (non-blocking; ignore failure)

Fire a `[SHIPPED]` curl ping noting v3.7.1 Batch 2 is live (token in `~/.claude/bin/telegram-notify.sh`).

---

## Self-Review

**Spec coverage:**
- Skeleton swaps (9 occ / 8 files) → Task 1 ✓
- Practice results scale-in → Task 2 ✓
- Practice question fade-up → Task 2 ✓
- Tutor message + empty-state fade-up → Task 3 ✓
- Diagrams result fade-up → Task 4 ✓
- Practice dashboard / study-guides / assignments staggered reveals → Task 5 ✓
- Study-guide + subject content fade-up → Task 6 ✓
- Notepad skeleton-only → Task 1 ✓
- Verify + ship + version bump → Task 7 ✓

**Placeholder scan:** All edits are exact string→string except the practice "Start a new quiz" section, which is a wrap-in-place instruction with precise anchors (heading text + element tags) — no code invented. ✓

**Type consistency:** `<Reveal index={number}>` matches its Batch-1 signature (`index?: number`, standard div props). `key={index}` on the Taking card and `key={s.id}`/`index={i}` on mapped Reveals are valid React. No new identifiers introduced. ✓

**Ambiguity:** The two identical `max-w-[1280px]` wrappers in `subjects/[id]/page.tsx` are disambiguated by including the following `<div className="no-print">` line in the match (Task 6 Step 2). ✓
