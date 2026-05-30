# PufferStudy — Cozy Redesign

**Date:** 2026-05-29
**Type:** Visual restyle (no feature/layout changes)
**Baseline:** v3.4.0 (`b8652ab`)

## Goal

Move PufferStudy away from its current cream/gold editorial aesthetic — which the user reads as "professional / corporate" — toward a **Soft & Cozy** look: warm, calm, and approachable, the kind of environment that makes a student *want* to sit down and study. This is a restyle, not a rebuild. Layout, navigation, and all v3.x functionality stay exactly as they are.

## Non-goals (explicitly out of scope)

- No layout or navigation changes. Study Desk structure, sidebar tabs, and every existing page stay put.
- No new features. No copy/content rewrite.
- No backend, data model, or API changes.

## Locked decisions

| Decision | Choice | Notes |
|---|---|---|
| Direction | Soft & Cozy | Warm pastels, soft rounded cards, gentle shadows, generous whitespace. |
| Font | **Figtree** (humanist sans) | Replaces Manrope (body) + Instrument Serif (wordmark). Warm but grown-up — not childish. |
| Themes | **Oat, Sage, Cocoa, Plum** | Replace Gold Atelier / Platinum / Space Grey / Midnight. 4-slot picker stays. |
| Default theme | **Cocoa** (warm-charcoal dark) | App opens in Cocoa; light themes available in picker. |
| Corners | Rounded again | ~18px cards, ~13px buttons. Reverses the recent square-corners work. Pills/avatars unchanged. |
| Shadows | Soft warm ambient shadow + small hover lift | Replaces the accent glow-ring as the default card treatment. |
| Background | Keep aurora, recolored warm + softened | Per-theme warm tones. |
| Mascot | **Moderate** | Puffer in empty states, loading, and small wins (streaks, quiz results). Supports a user-uploaded custom asset. |

## Theme palettes

Four themes, same warm DNA. Two light, two dark (warm charcoals, never cold grey). Hex values below are the starting design intent — fine to fine-tune during implementation, but the mood per theme is fixed.

### Oat (light)
- `--bg` `#f4efe7` · `--surface` `#fdfbf7` · `--surface-2` `#f0e8da`
- `--ink` `#3d362e` · `--ink-muted` `#8a8073` · `--ink-faint` `#b3a591`
- `--accent` `#c98a6d` (clay-peach) · secondary sage `#a7c4a0`
- `--border` `#eadfd0`
- Swatch: warm cream → clay gradient.

### Sage (light)
- `--bg` `#eef1ea` · `--surface` `#fafbf7` · `--surface-2` `#e6ebe0`
- `--ink` `#33392f` · `--ink-muted` `#6e7567` · `--ink-faint` `#97a08c`
- `--accent` `#7f9a6e` (sage) · secondary warm peach `#d89a78`
- `--border` `#dde3d6`
- Swatch: soft green gradient.

### Cocoa (dark) — DEFAULT
- `--bg` `#241f1a` · `--surface` `#322b23` · `--surface-2` `#3b332a`
- `--ink` `#f3ebdd` · `--ink-muted` `#c2b39e` · `--ink-faint` `#8a7d6c`
- `--accent` `#e0a17e` (warm peach) · secondary sage `#a7c4a0`
- `--border` `#443a2f`
- Swatch: warm charcoal → peach gradient.

### Plum (dark)
- `--bg` `#211b29` · `--surface` `#2e2638` · `--surface-2` `#372e44`
- `--ink` `#efe7f3` · `--ink-muted` `#c0b3cc` · `--ink-faint` `#8c7e98`
- `--accent` `#b9a0e0` (lavender) · secondary warm peach `#e0a17e`
- `--border` `#3f3349`
- Swatch: deep aubergine → lavender gradient.

All four must still define every key in `REQUIRED_VARS` (`--bg`, `--bg-grad-top/bottom`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--ink`, `--ink-muted`, `--ink-faint`, `--accent`, `--accent-light`, `--accent-deep`, `--primary`, `--primary-foreground`, `--warn`, `--danger`). Derive the missing tints/shades from the values above during implementation.

## Typography

- Single family: **Figtree** (Google Fonts), weights 400/500/600/700.
- Body text: Figtree 400/500.
- Headings / emphasis: Figtree 600/700.
- **Wordmark:** "Puffer" in Figtree 700 ink, "Study" in Figtree 700 accent color. Drop Instrument Serif entirely.
- Remove the Manrope and Instrument Serif imports from `app/layout.tsx`. The Pomodoro LCD font (DSEG7 Classic) is unrelated and stays.

## Mascot

A `Puffer` component used at **moderate** prominence:
- Empty states (e.g. no subjects yet, no flashcard decks, empty notepad list).
- Loading moments (generation in progress).
- Small celebrations (streak hit, quiz completed, deck finished).

**Asset strategy:**
- Component renders an image from `public/` if a custom asset exists (user intends to upload their own pufferfish — `public/puffer.svg` or `public/puffer.png`).
- Falls back to a clean inline SVG puffer so the work is never blocked on the asset.
- Props: `size`, `mood` (`idle` | `happy`) so a future second pose can slot in. Until a custom `happy` asset exists, both moods render the same source.
- The component is presentational only — no layout shifts, no new routes.

## Visual language

- **Radius tokens** (`globals.css` `@theme`): restore non-zero values — cards ~18px, buttons ~13px, inputs ~12px. Remove the `[class*="rounded-["] { border-radius: 0 !important }` override. Restore `.glow-card` border-radius to ~18px. Keep `.pill` at 999px and `:focus-visible` at 4px.
- **Card treatment:** soft warm ambient shadow always on (`0 6px 18px rgba(warm,.06)`), small `translateY(-2px)` lift on hover. The existing accent glow-on-hover can stay as a subtle secondary effect or be dropped — implementation detail, lean toward the soft-shadow look from the approved mockup.
- **Aurora:** keep the existing `body::before/::after` aurora machinery (and the `isolation: isolate` fix) but recolor `--aurora-color-a/b` and `--aurora-opacity` per theme to warm cozy tones, softened.
- Honor the existing gotchas: no `color-mix()` inside `repeating-linear-gradient`; keep `isolation: isolate` on body for the aurora pseudo-elements.

## Migration

Existing users have a theme id persisted (localStorage + Clerk metadata). Map legacy → new so nobody breaks:

| Legacy id | New id |
|---|---|
| `atelier` | `oat` |
| `platinum` | `sage` |
| `spacegrey` | `cocoa` |
| `midnight` | `plum` |
| anything else / unset | `cocoa` (default) |

Extend the existing migration in `theme-provider.tsx` / `lib/themes.ts` (which already migrates legacy v2.0–v2.2 ids). Update `lib/themes.test.ts` to cover the new ids and the legacy→cozy mapping.

## Affected files

- `lib/themes.ts` — replace `ThemeId` union + `THEMES` array + swatches; migration map.
- `lib/themes.test.ts` — update id assertions + migration cases.
- `components/theme-provider.tsx` — default `cocoa`, migrate stored ids.
- `components/theme-picker.tsx` — new names + swatch gradients.
- `app/layout.tsx` — Figtree import; remove Manrope + Instrument Serif.
- `app/globals.css` — radius tokens, card shadows, `.glow-card` radius, aurora recolor.
- `components/app-bar.tsx` — Figtree wordmark.
- `components/puffer.tsx` — **new** mascot component (asset-with-SVG-fallback).
- Empty/loading/celebration call sites across existing pages — wire in `<Puffer/>` (subjects grid, flashcards list + completion, study-guides/practice empty states, notepad empty list).

## Success criteria

- Every page renders in all four cozy themes with no contrast/legibility regressions; Cocoa is the default on a fresh load.
- A user who had Gold Atelier / Platinum / Space Grey / Midnight saved lands on the mapped cozy theme, not a broken/blank theme.
- Corners are rounded, cards have soft warm shadows, Figtree is the only UI font, wordmark reads "Puffer**Study**" in Figtree.
- Puffer appears in at least the primary empty states and one celebration moment, using the custom asset when present and the inline SVG otherwise.
- No functional regressions: every v3.x feature works exactly as before.

## Open items

- User will upload a custom pufferfish asset to `public/` (`puffer.svg` preferred). Until then, the inline SVG fallback ships.
- Telegram `[SHIPPED]` ping still blocked by Zscaler — ship without it, per existing decision.
