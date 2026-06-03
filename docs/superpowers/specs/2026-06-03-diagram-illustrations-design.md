# Better Diagram Illustrations (Sub-project B)

**Date:** 2026-06-03
**Status:** Design — approved in brainstorm, pending implementation
**Version target:** minor bump (visible quality improvement, no data/schema change)

## Goal

Make the diagrams the Diagrams tab (and Tutor) produce look **on-brand,
readable, and reliable**. User feedback: the *content/structure* the AI picks is
fine — the problems are presentation and robustness:
1. **Off-brand / plain** — renderer uses Mermaid's stock `neutral`/`dark` themes,
   not the cozy warm palette.
2. **Cramped / hard to read** — tight spacing, overlap, small inline text.
3. **Breaks / ugly fallback** — occasional syntax failures dump raw Mermaid code.

This is a **rendering + robustness pass**, NOT a prompt-content overhaul. The
only prompt change is tightening syntax-safety (to cut parse failures), not what
the diagram says.

The Mermaid renderer (`components/mermaid-diagram.tsx`) is shared by the Diagrams
tab and the Tutor, so every improvement here benefits both.

## Scope

### In scope
- **Theming:** Mermaid `theme: "base"` + `themeVariables` derived from the live
  CSS theme tokens, so diagrams follow the active cozy theme (Latte/Oat/Sage/
  Cocoa/Plum).
- **Readability:** Mermaid layout config (spacing, curve, padding, font size,
  label wrapping); larger inline render; keep the lightbox.
- **Reliability:** a pure `sanitizeMermaid()` pre-render pass; a small
  syntax-safety tightening in the prompt; a graceful fallback card replacing the
  raw-code dump.

### Out of scope (YAGNI / follow-ups)
- Overhauling the AI's content choices, type selection, node counts, or the
  "key" (user says content is fine).
- Dropping diagram types (timeline/mindmap). Revisit only if they still look
  weak *after* theming — a separate follow-up, not guessed now.
- New diagram types, saving/persistence (Diagrams tab stays ephemeral).

## Design

### 1. On-brand theming — `components/mermaid-diagram.tsx`

Replace `theme: mode === "dark" ? "dark" : "neutral"` with `theme: "base"` plus a
`themeVariables` object built at render time from `getComputedStyle(document.
documentElement)`. The component already has `useDeskTheme()` (`themeId`) and
`THEMES` (for `mode`).

Token → Mermaid variable mapping (read each via `cssVar("--x")`):
- `fontFamily` ← app sans (`--font-sans` / Figtree); `fontSize` ~`15px`
- `background` ← transparent (container supplies bg)
- `primaryColor` / `mainBkg` ← `--surface-2` (node fill)
- `primaryBorderColor` / `nodeBorder` ← `--accent`
- `primaryTextColor` / `textColor` / `nodeTextColor` ← `--ink`
- `lineColor` / `edgeLabelBackground` ← `--accent-deep` / `--surface`
- `secondaryColor` ← `--surface-3`; `tertiaryColor` ← `--surface`
- `clusterBkg` ← `--surface`; `clusterBorder` ← `--border-strong`
- `titleColor` ← `--ink`
- mindmap/timeline section fills ← surface variants

Make the render effect depend on `themeId` (currently `[code, mode]` → `[code,
themeId]`) so switching cozy themes re-renders with the new palette. Resolve
`mode` from `themeId` inside the effect.

A small `cssVar(name)` helper reads + trims `getComputedStyle(...).getProperty
Value(name)`; falls back to a sensible default if empty (SSR/edge).

### 2. Readability — `components/mermaid-diagram.tsx`

Add to `mermaid.initialize`:
```
flowchart: { nodeSpacing: 50, rankSpacing: 60, curve: "basis", padding: 12,
             htmlLabels: true, useMaxWidth: true }
```
- Bump base `fontSize` (~15px) for legibility.
- Quoted labels wrap via `htmlLabels`.
- Inline container: render comfortably large (raise the inline min display so
  small diagrams aren't tiny); keep `overflow-x-auto` + the click-to-zoom
  lightbox for dense ones.

### 3. Reliability + graceful fallback

**`lib/diagram.ts` — `sanitizeMermaid(code: string): string` (pure, tested):**
- Trim; strip a leading/trailing ``` fence if present (reuse/extend
  `stripFences`).
- Normalize `<br>` and `<BR>` → `<br/>`.
- Replace smart quotes `" " ' '` → straight quotes.
- Collapse Windows newlines `\r\n` → `\n`.
- Return cleaned string. (Conservative — never throws; if nothing matches,
  returns input unchanged.)

Call `sanitizeMermaid(code)` in the renderer before `mermaid.render(...)`.

**Prompt — `app/api/diagram/route.ts` (`DIAGRAM_SYSTEM`), syntax-safety only:**
- Strengthen: for flowchart/graph, ALWAYS use quoted labels (`A["..."]`); never
  put parentheses, colons, semicolons, or quotes inside an *unquoted* label.
- Keep mindmap/timeline labels short and plain (no punctuation).
- (No change to node counts, emoji guidance, type selection, or the key.)

**Graceful fallback — `components/mermaid-diagram.tsx`:**
Replace the `<pre>` raw-code dump (the `failed` branch) with a calm card: a
muted icon + "Couldn't draw this one — try Regenerate or a different type," with
the raw Mermaid tucked inside a collapsed `<details><summary>Show code</summary>`
for recovery/debugging. Styled with the app's surface/border tokens.

## Components / boundaries

| Unit | Change | Depends on |
|---|---|---|
| `components/mermaid-diagram.tsx` | theming via themeVariables, layout config, themeId dep, sanitize call, graceful fallback | `useDeskTheme`, `THEMES`, `sanitizeMermaid` |
| `lib/diagram.ts` | add pure `sanitizeMermaid` | none |
| `app/api/diagram/route.ts` | tighten syntax-safety lines in `DIAGRAM_SYSTEM` | — |

No new files, no new dependencies (mermaid already installed). The renderer stays
one focused component.

## Accessibility / behavior

- Theme follows light/dark correctly (mode derived from `themeId`); text contrast
  comes from `--ink` on `--surface-2`, which already meets the app's contrast.
- Lightbox, zoom, keyboard shortcuts unchanged.
- `securityLevel: "strict"` retained (sanitize does not relax security).

## Testing

- **Unit:** `sanitizeMermaid` cases in `lib/diagram.test.ts` — fence strip, `<br>`
  normalize, smart-quote replace, CRLF, and no-op passthrough. Existing 97 tests
  stay green.
- **Visual (live, localhost):** generate diagrams across a couple of subjects/
  topics on light AND dark themes; confirm on-brand colors, readable spacing,
  theme-switch recolor, and that a deliberately-broken diagram shows the graceful
  fallback (not a raw dump). Also spot-check the Tutor still renders diagrams.
- **Gate:** `tsc` clean · `vitest` green · `next build` succeeds.

## Success criteria

- Diagrams visually match the active cozy theme (not Mermaid grey/dark).
- Nodes/edges are comfortably spaced and legible inline; lightbox still works.
- Common syntax slips no longer break rendering; genuine failures show a calm
  fallback card with optional code, never a raw dump.
- Tutor diagrams inherit all of the above.
- No regressions: tsc clean, 97 tests green, build passes, no new deps.

## Follow-ups (separate)

- If timeline/mindmap still look weak after theming → consider dropping them.
- Sub-project C: tutor opt-in diagrams + "Add diagram" suggested-action chips.
