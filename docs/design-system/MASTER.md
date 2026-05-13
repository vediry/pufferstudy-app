# PufferStudy — Design System (MASTER)

**Direction:** Notebook — warm & tactile
**Date:** 2026-05-13
**Status:** Locked

The single source of truth for visual design across PufferStudy. Page-specific overrides may live in `docs/design-system/pages/*.md` and take precedence over this file.

---

## 1. Palette

### Brand

| Token | Light | Dark | Use |
|---|---|---|---|
| `puffer-50`  | `#FFF4EE` | `#2A1810` | tint for hover backgrounds |
| `puffer-100` | `#FFE2D2` | `#3A1F14` | subtle fills |
| `puffer-200` | `#FFC4A6` | `#5C2E1C` | borders on accent surfaces |
| `puffer-400` | `#FF9466` | `#FF9466` | hover state of primary |
| `puffer-500` | `#FF7849` | `#FF7849` | **brand primary — pufferfish orange** |
| `puffer-600` | `#E85A2A` | `#E85A2A` | active/pressed primary |
| `puffer-700` | `#B73E15` | `#FF6A38` | text on light tint surfaces |

### Surface

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg`         | `#FBF7EE` | `#1A1814` | page background (cream paper / inked paper) |
| `surface`    | `#FFFFFF` | `#231F1A` | cards, sheets |
| `surface-2`  | `#F4EEDF` | `#2C2722` | nested surfaces, input fields |
| `border`     | `#E8DEC8` | `#3A332C` | hairline dividers |
| `border-strong` | `#D5C5A3` | `#52483D` | emphasized borders, focus rings (paired with ring color) |

### Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `ink`        | `#1F1B16` | `#F5EFE2` | primary text |
| `ink-muted`  | `#5C5044` | `#A89B86` | secondary text |
| `ink-faint`  | `#8B7E6C` | `#7A6F60` | tertiary text, captions |

### Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `success`   | `#3B8C4F` | `#5EBD75` | success states, "saved" |
| `warning`   | `#C97A1A` | `#E89940` | amber test-countdown (≤7 days) |
| `danger`    | `#C0392B` | `#E66053` | red test-countdown (≤3 days), destructive |
| `info`      | `#3578C9` | `#6BA6E5` | informational hints |

### Contrast check

All foreground/background pairs listed above meet WCAG AA (4.5:1) when used in the documented combinations. Verify any *new* pair with a contrast checker before shipping.

---

## 2. Typography

**Font (locked):** Spline Sans (sans + variable weight 300–700). Mono pair: Spline Sans Mono. Loaded via `next/font/google` for self-hosting + zero CLS.

| Role | Family | Weight | Size | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| Display | Spline Sans | 700 | 3.0rem (48px) | 1.1 | -0.02em | Landing hero, large headings |
| H1 | Spline Sans | 700 | 2.0rem (32px) | 1.2 | -0.015em | Page titles |
| H2 | Spline Sans | 600 | 1.5rem (24px) | 1.25 | -0.01em | Section titles |
| H3 | Spline Sans | 600 | 1.25rem (20px) | 1.3 | -0.005em | Subsection titles, card titles |
| Body L | Spline Sans | 400 | 1.0625rem (17px) | 1.55 | 0 | Long-form copy on `/cheatsheet` |
| Body | Spline Sans | 400 | 1.0rem (16px) | 1.55 | 0 | Default UI body |
| Label | Spline Sans | 500 | 0.875rem (14px) | 1.4 | 0.005em | Form labels |
| Caption | Spline Sans | 400 | 0.8125rem (13px) | 1.4 | 0.005em | Help text, captions, footnotes |
| Mono | Spline Sans Mono | 400 | 0.875rem (14px) | 1.5 | 0 | API key field, data tabular |

**Rules**
- Body text never below 16px (mobile auto-zoom guard).
- Headings use weight 600/700; never lighter.
- Line-height ≥ 1.5 for any text block longer than one line.
- Tabular nums on stats / countdown values (`font-variant-numeric: tabular-nums`).

---

## 3. Spacing

8pt grid. Tokens: `0.5 1 1.5 2 3 4 5 6 8 10 12 16` × 4px.

| Scope | Spacing |
|---|---|
| Card inner padding | 24px |
| Card gap (grid) | 16px (mobile) / 24px (≥768px) |
| Section vertical | 64px (mobile) / 96px (≥1024px) |
| Form field gap | 16px |
| Inline icon-text gap | 8px |
| Page horizontal inset | 16px (mobile) / 32px (≥768px) / max-width 1120px container |

---

## 4. Radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | small chips, input fields |
| `radius` | 12px | buttons, badges, list items |
| `radius-lg` | 16px | cards |
| `radius-xl` | 24px | hero surfaces, modals |
| `radius-full` | 9999px | pills, avatars |

---

## 5. Elevation (shadow)

Notebook direction is *tactile* — shadows are soft and warm, not crisp blue. All shadows in light mode use a warm brown tint; dark mode shadows are deeper and tighter.

| Token | Light | Dark |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(63, 44, 24, 0.06)` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `shadow` | `0 4px 12px rgba(63, 44, 24, 0.08), 0 1px 3px rgba(63, 44, 24, 0.04)` | `0 4px 12px rgba(0, 0, 0, 0.5)` |
| `shadow-lg` | `0 12px 32px rgba(63, 44, 24, 0.10), 0 4px 8px rgba(63, 44, 24, 0.06)` | `0 12px 32px rgba(0, 0, 0, 0.6)` |

Hover lift on cards: translate `-1px` + shift from `shadow` → `shadow-lg`. Use `transform`, not `top`.

---

## 6. Motion

| Use | Duration | Easing |
|---|---|---|
| Hover | 150ms | `ease-out` |
| Press (scale 0.97) | 100ms in / 200ms out | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Modal/dialog enter | 200ms | `ease-out` |
| Modal/dialog exit | 140ms | `ease-in` |
| Page route fade | 180ms | `ease-out` |

Respect `prefers-reduced-motion: reduce` — disable all non-essential animations.

---

## 7. Icons

- **Library:** Lucide React only.
- **Stroke width:** 1.75 (slightly chunkier than default 1.5 to match warm/tactile feel).
- **Sizes:** 16 / 20 / 24 px. Default 20.
- **Never:** Emoji as structural icons. Emoji are content-only (e.g. inside a user-typed caption).

---

## 8. Forms

- Label always visible above the field (never placeholder-only).
- Helper text persistent below complex inputs, 13px ink-muted.
- Errors render below the field in `danger` color, plus `aria-live="polite"` toast for screen readers.
- Required marked with `*` after label, no asterisk-only required state.
- Submit buttons disabled during async; show spinner inside the button (don't move the label).

---

## 9. Test-countdown badge (functional color)

| Days until test | Token | Background | Text |
|---|---|---|---|
| ≤ 3 | `danger`  | `#C0392B / #E66053` | white |
| ≤ 7 | `warning` | `#C97A1A / #E89940` | white |
| > 7 | neutral   | `surface-2`         | `ink-muted` |
| past | `ink-faint` | `surface-2`       | `ink-faint`, label `"past"` |

Badge: pill, 6px vertical / 10px horizontal padding, 12px text, tabular nums.

---

## 10. Print stylesheet (cheat sheet view only)

- Strip `bg`, `surface`, all shadows → white paper.
- Set body font-size to 11pt, line-height 1.5.
- Hide app chrome (header, footer, action buttons) via `@media print { .no-print { display: none } }`.
- Page margins: 0.5in (Letter/A4).
- Headings: keep weight 600+ but reduce size by one step.
- Force `color-adjust: exact` on the highlighter color if/when introduced.

---

## 11. Anti-patterns (do not do)

- Emoji icons in navigation, buttons, badges, or any structural UI.
- Mixed icon stroke widths in the same surface.
- Plain black text (`#000`) — always use `ink` token (`#1F1B16` light / `#F5EFE2` dark).
- Pure white card on cream page — always use `surface` (`#FFFFFF` light) for contrast hierarchy.
- Shadows in dark mode that use brown tint (use neutral black tint in dark).
- Loading spinners that block UI longer than 1s without skeleton.
- Toast-only error feedback for form fields. Always also show error inline.
