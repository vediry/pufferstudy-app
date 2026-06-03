# Better Diagram Illustrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered diagrams on-brand (follow the active cozy theme), more readable, and robust against syntax breakage — without changing the AI's diagram content.

**Architecture:** Re-theme the shared Mermaid renderer (`theme: "base"` + `themeVariables` from live CSS tokens) and tune layout; add a pure `sanitizeMermaid()` pre-render pass; tighten the prompt's syntax-safety only; replace the raw-code failure dump with a graceful fallback card. The renderer is shared by the Diagrams tab and the Tutor, so both improve.

**Tech Stack:** Next.js 15, React 19, mermaid ^11 (already installed), Tailwind v4, Vitest 2 (node), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-03-diagram-illustrations-design.md`

---

### Task 1: `sanitizeMermaid` helper (TDD)

**Files:**
- Modify: `lib/diagram.ts`
- Test: `lib/diagram.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/diagram.test.ts` (keep existing imports; add `sanitizeMermaid` to the import from `./diagram` if the file imports named symbols — otherwise add a new import line `import { sanitizeMermaid } from "./diagram";`):

```ts
describe("sanitizeMermaid", () => {
  it("strips a ```mermaid fence wrapper", () => {
    expect(sanitizeMermaid("```mermaid\nflowchart TD\nA-->B\n```")).toBe(
      "flowchart TD\nA-->B",
    );
  });

  it("strips a plain ``` fence wrapper", () => {
    expect(sanitizeMermaid("```\nmindmap\nroot\n```")).toBe("mindmap\nroot");
  });

  it("normalizes <br>, <BR> and <br /> to <br/>", () => {
    expect(sanitizeMermaid('A["x<br>y<BR>z<br />w"]')).toBe('A["x<br/>y<br/>z<br/>w"]');
  });

  it("straightens smart quotes", () => {
    expect(sanitizeMermaid("A[“hi” ‘there’]")).toBe("A[\"hi\" 'there']");
  });

  it("converts CRLF to LF", () => {
    expect(sanitizeMermaid("flowchart TD\r\nA-->B")).toBe("flowchart TD\nA-->B");
  });

  it("passes clean code through unchanged", () => {
    expect(sanitizeMermaid("flowchart TD\nA-->B")).toBe("flowchart TD\nA-->B");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(sanitizeMermaid(null)).toBe("");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/diagram.test.ts`
Expected: FAIL — `sanitizeMermaid` is not exported.

- [ ] **Step 3: Implement `sanitizeMermaid` in `lib/diagram.ts`**

Add at the end of `lib/diagram.ts`:

```ts
// Conservative pre-render cleanup for model-emitted Mermaid. Never throws;
// returns the input unchanged when nothing matches. Kept pure for testing.
export function sanitizeMermaid(code: string): string {
  if (typeof code !== "string") return "";
  let s = code.replace(/\r\n/g, "\n").trim();
  const fenced = s.match(/^```(?:mermaid)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) s = fenced[1].trim();
  s = s.replace(/<br\s*\/?>/gi, "<br/>");
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return s;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/diagram.test.ts`
Expected: PASS — all existing diagram tests plus the 7 new `sanitizeMermaid` cases.

- [ ] **Step 5: Commit**

```bash
git add lib/diagram.ts lib/diagram.test.ts
git commit -m "feat(diagram): add pure sanitizeMermaid pre-render helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Re-theme the Mermaid renderer + layout + sanitize + fallback

**Files:**
- Modify: `components/mermaid-diagram.tsx`

- [ ] **Step 1: Update imports**

Change the lucide import line:
```tsx
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
```
to:
```tsx
import { Maximize2, ZoomIn, ZoomOut, RotateCcw, X, ImageOff } from "lucide-react";
```
And add, after the `lucide-react` import:
```tsx
import { sanitizeMermaid } from "@/lib/diagram";
```

- [ ] **Step 2: Replace the initialize + render block with themed config**

Find:
```tsx
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: mode === "dark" ? "dark" : "neutral",
          fontFamily: "var(--font-sans, inherit)",
        });
        const { svg } = await mermaid.render(`mmd-${diagramCounter++}`, code.trim());
```
Replace with:
```tsx
        const mermaid = (await import("mermaid")).default;
        const root = getComputedStyle(document.documentElement);
        const v = (name: string, fallback: string) =>
          root.getPropertyValue(name).trim() || fallback;
        const sans = v("--font-sans", "Figtree, ui-sans-serif, system-ui, sans-serif");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: sans,
          themeVariables: {
            fontFamily: sans,
            fontSize: "15px",
            background: v("--surface", "#f1ebdd"),
            primaryColor: v("--surface-2", "#e4d9c4"),
            primaryBorderColor: v("--accent", "#c98a6d"),
            primaryTextColor: v("--ink", "#3d362e"),
            secondaryColor: v("--surface-3", "#d8cbb0"),
            tertiaryColor: v("--surface", "#f1ebdd"),
            mainBkg: v("--surface-2", "#e4d9c4"),
            nodeBorder: v("--accent", "#c98a6d"),
            nodeTextColor: v("--ink", "#3d362e"),
            textColor: v("--ink", "#3d362e"),
            lineColor: v("--accent-deep", "#a86a4f"),
            edgeLabelBackground: v("--surface", "#f1ebdd"),
            clusterBkg: v("--surface", "#f1ebdd"),
            clusterBorder: v("--border-strong", "#c9b692"),
            titleColor: v("--ink", "#3d362e"),
          },
          flowchart: { nodeSpacing: 50, rankSpacing: 55, curve: "basis", padding: 12 },
        });
        const { svg } = await mermaid.render(
          `mmd-${themeId}-${diagramCounter++}`,
          sanitizeMermaid(code),
        );
```

(`themeId` is already destructured from `useDeskTheme()` at the top of the component; using it in the render id also keeps it a legitimate effect dependency.)

- [ ] **Step 3: Re-run the render effect on theme change**

Find the effect dependency array:
```tsx
  }, [code, mode]);
```
Replace with:
```tsx
  }, [code, themeId]);
```

(`mode` is still computed at the top of the component and is still used by the `<Lightbox>` background — leave that line as-is. The effect itself no longer depends on `mode` because the theme is now `"base"`, driven by `themeId`-linked CSS vars.)

- [ ] **Step 4: Replace the raw-code failure dump with a graceful fallback card**

Find:
```tsx
  if (failed) {
    return (
      <pre className="my-2 overflow-x-auto rounded-[10px] border border-default bg-surface-2/60 p-3 text-xs text-ink-muted">
        {code.trim()}
      </pre>
    );
  }
```
Replace with:
```tsx
  if (failed) {
    return (
      <div className="my-2 rounded-[12px] border border-default bg-surface-2/40 p-4 text-sm">
        <p className="flex items-center gap-2 text-ink-muted">
          <ImageOff className="h-4 w-4" strokeWidth={1.75} />
          Couldn&apos;t draw this one. Try Regenerate, or switch the diagram type.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-faint">Show code</summary>
          <pre className="mt-2 overflow-x-auto rounded-[8px] border border-default bg-surface p-2 text-xs text-ink-muted">
            {code.trim()}
          </pre>
        </details>
      </div>
    );
  }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Confirms `themeId` is in scope, the `v()` helper types, the `sanitizeMermaid` import, and the `ImageOff` import all resolve.)

- [ ] **Step 6: Commit**

```bash
git add components/mermaid-diagram.tsx
git commit -m "feat(diagram): theme mermaid to active palette, tune layout, graceful fallback

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Tighten prompt syntax-safety (reliability only)

**Files:**
- Modify: `app/api/diagram/route.ts`

- [ ] **Step 1: Strengthen the unquoted-label rule**

In `DIAGRAM_SYSTEM`, find:
```
- Apart from that leading emoji, inside UNQUOTED labels use only letters, numbers and spaces — no parentheses, quotes, colons, or slashes. (Quoted flowchart/graph labels may contain richer text.)
```
Replace with:
```
- ALWAYS use quoted labels for flowchart and graph nodes — e.g. A["..."] — never leave a flowchart/graph label unquoted. Inside any UNQUOTED label (mindmap and timeline only) use ONLY a leading emoji plus letters, numbers and spaces — no parentheses, quotes, colons, semicolons, slashes, or other punctuation.
```

(Content guidance — node counts, emoji, type selection, the key — is intentionally unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (string-only change).

- [ ] **Step 3: Commit**

```bash
git add app/api/diagram/route.ts
git commit -m "feat(diagram): require quoted flowchart/graph labels to cut parse failures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify + ship to prod

**Files:** `package.json`

- [ ] **Step 1: Verify gate**

Run: `npx tsc --noEmit` → no errors.
Run: `npx vitest run` → all tests pass (97 prior + 7 new sanitizeMermaid = 104).
Run: `npx next build` → succeeds. (Stop the dev server first if one is running, so it doesn't fight over `.next`.)

- [ ] **Step 2: Live smoke on localhost:3000**

On the Diagrams tab: generate diagrams for a couple of subjects/topics on a LIGHT theme (e.g. Latte) and a DARK theme (e.g. Plum); confirm nodes/edges use the theme palette, spacing is readable, and switching theme recolors the diagram. Force a broken diagram (or trust the fallback) and confirm the graceful card shows (with a working "Show code" details), not a raw dump. Spot-check the Tutor renders a `mermaid` reply with the new theming.

- [ ] **Step 3: Version bump + commit + tag**

In `package.json` change `"version": "3.7.1"` to `"version": "3.8.0"`.
```bash
git add package.json
git commit -m "chore: bump version to 3.8.0 (better diagram illustrations)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git tag -a v3.8.0 -m "Better diagram illustrations"
```

- [ ] **Step 4: Merge to main + push (Vercel auto-deploys)**

```bash
git checkout main
git merge --ff-only feat/diagram-illustrations
git push origin main --follow-tags
```

- [ ] **Step 5: `[SHIPPED]` Telegram ping** (non-blocking; ignore failure)

Fire a `[SHIPPED]` curl ping noting v3.8.0 better diagrams is live (token in `~/.claude/bin/telegram-notify.sh`).

---

## Self-Review

**Spec coverage:**
- Theming via `theme:"base"` + `themeVariables` from live tokens → Task 2 ✓
- Re-render on theme change (`themeId` dep) → Task 2 ✓
- Readability layout config (spacing/curve/padding/fontSize) → Task 2 ✓
- `sanitizeMermaid` pure helper + tests → Task 1 ✓; called pre-render → Task 2 ✓
- Prompt syntax-safety tightening (content unchanged) → Task 3 ✓
- Graceful fallback card replacing raw dump → Task 2 ✓
- Testing (unit + live + gate) → Tasks 1, 4 ✓
- Shared renderer benefits Tutor → inherent (Task 2 edits the shared component) ✓

**Placeholder scan:** Every code step contains complete code; no TBD/TODO. ✓

**Type consistency:** `sanitizeMermaid(code: string): string` is defined in Task 1 and imported/called in Task 2 with the same signature. `themeId` and `mode` come from the existing `useDeskTheme()` + `THEMES` lookup already in the file. The `v(name, fallback)` helper is defined and used within the same effect scope. `ImageOff` is imported in Task 2 Step 1 and used in Step 4. ✓

**Ambiguity:** Task 2 Step 3 explicitly notes `mode` stays for the Lightbox and only the effect dep array changes — no ambiguity about removing `mode`. ✓
