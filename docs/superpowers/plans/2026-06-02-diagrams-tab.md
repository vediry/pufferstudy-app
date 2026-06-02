# Diagrams / Map-out Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone **Diagrams** tab that turns a chosen subject's materials — or any typed topic — into a single readable Mermaid diagram (mindmap/flowchart/timeline/graph) with a short explanatory key.

**Architecture:** A pure, unit-tested helper module (`lib/diagram.ts`) builds the model prompt and parses the model's JSON reply. A thin standalone route (`app/api/diagram/route.ts`) wraps those helpers around a non-streaming Gemini call — mirroring the just-shipped `/api/tutor`. A client page (`app/diagrams/page.tsx`) drives it and renders the result with the existing `<MermaidDiagram>`. The sidebar gains a Diagrams tab; `MobileNav` gains a "More" overflow because this is the 8th tab. No database, no migration — diagrams are ephemeral.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Gemini `generateContent` (BYO key from localStorage), vitest, Mermaid (already a dependency), Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-06-01-diagrams-tab-design.md`

---

## File Structure

- **Create** `lib/diagram.ts` — types (`DiagramType`, `DiagramResult`, `DiagramRequest`, `ParseOutcome`), `buildDiagramPrompt`, `parseDiagramResponse`. Pure, no I/O.
- **Create** `lib/diagram.test.ts` — unit tests for the two helpers.
- **Create** `app/api/diagram/route.ts` — standalone Gemini endpoint; holds `DIAGRAM_SYSTEM`; thin wrapper over the helpers.
- **Create** `app/diagrams/page.tsx` — the tab UI.
- **Modify** `components/sidebar.tsx` — add Diagrams to `NAV`; rework `MobileNav` into primary tabs + "More".
- **Reuse** `components/mermaid-diagram.tsx` — unchanged (already in prod).

---

## Task 1: Pure helpers + types (`lib/diagram.ts`)

**Files:**
- Create: `lib/diagram.ts`
- Test: `lib/diagram.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/diagram.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildDiagramPrompt,
  parseDiagramResponse,
  DIAGRAM_TYPES,
} from "@/lib/diagram";

describe("buildDiagramPrompt", () => {
  it("uses the typed topic when present", () => {
    const p = buildDiagramPrompt({ topic: "causes of WWI" });
    expect(p).toContain("causes of WWI");
  });

  it("falls back to a subject overview when no topic is given", () => {
    const p = buildDiagramPrompt({ subjectName: "Biology" });
    expect(p.toLowerCase()).toContain("overview");
    expect(p).toContain("Biology");
  });

  it("includes the subject materials block when materials are present", () => {
    const p = buildDiagramPrompt({
      subjectName: "Biology",
      materials: "Cells are the unit of life.",
    });
    expect(p).toContain("<materials>");
    expect(p).toContain("Cells are the unit of life.");
  });

  it("omits the materials block when materials are empty", () => {
    const p = buildDiagramPrompt({ subjectName: "Biology", materials: "   " });
    expect(p).not.toContain("<materials>");
  });

  it("injects a forceType instruction only when forceType is set", () => {
    expect(buildDiagramPrompt({ topic: "x" })).not.toMatch(/Use a .* diagram/);
    const p = buildDiagramPrompt({ topic: "x", forceType: "timeline" });
    expect(p).toContain("Use a timeline diagram");
  });

  it("returns an empty string when there is nothing to map", () => {
    expect(buildDiagramPrompt({})).toBe("");
  });
});

describe("parseDiagramResponse", () => {
  const good = JSON.stringify({
    type: "flowchart",
    title: "Photosynthesis",
    mermaid: "flowchart TD\n  A --> B",
    key: [{ label: "A", text: "start" }],
  });

  it("parses a well-formed JSON reply", () => {
    const out = parseDiagramResponse(good);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.type).toBe("flowchart");
      expect(out.result.title).toBe("Photosynthesis");
      expect(out.result.mermaid).toContain("flowchart TD");
      expect(out.result.key).toHaveLength(1);
    }
  });

  it("tolerates ```json fences and surrounding whitespace", () => {
    const out = parseDiagramResponse("\n```json\n" + good + "\n```\n");
    expect(out.ok).toBe(true);
  });

  it("repairs a missing/invalid type to a safe default", () => {
    const out = parseDiagramResponse(
      JSON.stringify({ mermaid: "mindmap\n  root((X))", type: "bogus" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(DIAGRAM_TYPES).toContain(out.result.type);
  });

  it("coerces a missing key to an empty array", () => {
    const out = parseDiagramResponse(
      JSON.stringify({ type: "mindmap", mermaid: "mindmap\n  root((X))" }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result.key).toEqual([]);
  });

  it("returns a typed error (not a throw) on unparseable input", () => {
    const out = parseDiagramResponse("not json at all");
    expect(out.ok).toBe(false);
    if (!out.ok) expect(typeof out.error).toBe("string");
  });

  it("errors when there is no mermaid body", () => {
    const out = parseDiagramResponse(JSON.stringify({ type: "mindmap" }));
    expect(out.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/diagram.test.ts`
Expected: FAIL — `Cannot find module '@/lib/diagram'`.

- [ ] **Step 3: Write the implementation**

Create `lib/diagram.ts`:

```ts
// Pure helpers for the Diagrams tab: build the model prompt and parse the
// model's JSON reply into a typed result. No I/O — unit-tested in diagram.test.ts.

export type DiagramType = "mindmap" | "flowchart" | "timeline" | "graph";

export const DIAGRAM_TYPES: DiagramType[] = [
  "mindmap",
  "flowchart",
  "timeline",
  "graph",
];

export type DiagramKeyEntry = { label: string; text: string };

export type DiagramResult = {
  type: DiagramType;
  title: string;
  mermaid: string;
  key: DiagramKeyEntry[];
};

export type DiagramRequest = {
  subjectName?: string;
  materials?: string;
  topic?: string;
  forceType?: DiagramType;
};

export type ParseOutcome =
  | { ok: true; result: DiagramResult }
  | { ok: false; error: string };

// Builds the user-turn text. The system prompt lives in the route.
// Returns "" when there is nothing to map (caller should not send a request).
export function buildDiagramPrompt(req: DiagramRequest): string {
  const topic = req.topic?.trim();
  const materials = req.materials?.trim();
  const parts: string[] = [];

  if (topic) {
    parts.push(`Make a diagram about this topic:\n${topic}`);
  } else if (req.subjectName) {
    parts.push(`Make an overview diagram for the subject "${req.subjectName}".`);
  } else {
    return "";
  }

  if (req.subjectName && materials) {
    parts.push(
      `Use this study material for "${req.subjectName}" as the source of truth:\n<materials>\n${materials}\n</materials>`,
    );
  }

  if (req.forceType) {
    parts.push(
      `Use a ${req.forceType} diagram. Do not pick a different diagram type.`,
    );
  }

  return parts.join("\n\n");
}

function stripFences(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : s;
}

function isKeyEntry(e: unknown): e is DiagramKeyEntry {
  return (
    !!e &&
    typeof e === "object" &&
    typeof (e as DiagramKeyEntry).label === "string" &&
    typeof (e as DiagramKeyEntry).text === "string"
  );
}

export function parseDiagramResponse(raw: string): ParseOutcome {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Empty response from the model." };
  }

  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, error: "Could not read the model response." };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Unexpected response shape." };
  }

  const obj = data as Record<string, unknown>;
  const mermaid = typeof obj.mermaid === "string" ? obj.mermaid.trim() : "";
  if (!mermaid) {
    return { ok: false, error: "The model didn't return a diagram." };
  }

  const type = DIAGRAM_TYPES.includes(obj.type as DiagramType)
    ? (obj.type as DiagramType)
    : "mindmap";
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const key = Array.isArray(obj.key)
    ? obj.key.filter(isKeyEntry).map((e) => ({ label: e.label, text: e.text }))
    : [];

  return { ok: true, result: { type, title, mermaid, key } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/diagram.test.ts`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add lib/diagram.ts lib/diagram.test.ts
git commit -m "feat(diagrams): pure prompt-builder + response-parser helpers"
```

---

## Task 2: API route (`app/api/diagram/route.ts`)

**Files:**
- Create: `app/api/diagram/route.ts`

(No unit test: the route is a thin wrapper over the Task 1 helpers and a network call, consistent with `app/api/tutor/route.ts`. Verified via build + manual run.)

- [ ] **Step 1: Write the route**

Create `app/api/diagram/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  buildDiagramPrompt,
  parseDiagramResponse,
  type DiagramRequest,
} from "@/lib/diagram";

// Standalone endpoint for the Diagrams tab. Kept separate from /api/generate
// so it can evolve independently of the production cheat-sheet pipeline.
// Non-streaming; returns a single JSON diagram object.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const DIAGRAM_SYSTEM = `You turn a topic or some study material into ONE clear, readable diagram for a student. Respond with ONLY a JSON object — no prose, no code fences — of this exact shape:
{
  "type": "mindmap" | "flowchart" | "timeline" | "graph",
  "title": "short heading for the diagram",
  "mermaid": "the Mermaid code (no backticks/fences)",
  "key": [ { "label": "short label", "text": "one-line plain-English explanation" } ]
}

Choosing the type — pick the best fit for the request UNLESS the user pins one:
- timeline — events over time / "what happened".
- flowchart TD — a process, steps, an algorithm, or a decision.
- mindmap — an overview of a topic broken into branches.
- graph LR — relationships/connections between concepts.

Make it readable on its own:
- For flowchart and graph, give each node a QUOTED label with a short title, then a <br/> line break, then a one-line description — e.g. A["☀️ Sunlight<br/>energy that powers the reaction"]. Quoting + <br/> is required so punctuation does not break parsing.
- For mindmap and timeline (which are stricter about multi-line text), keep node labels SHORT and put the detail in the key instead.
- Always fill "key" with 3 to 6 entries that explain the main parts in plain words.

Mermaid rules (follow exactly so it renders):
- Keep it focused: roughly 6 to 12 nodes.
- Give every node a single leading emoji that fits the subject (history 🏛️ 📜 ⚔️, biology 🧬 🔬 🌿, chemistry ⚗️ 🧪, geography 🗺️ 🌋, economics 💰 📈, etc.) then the label.
- Apart from that leading emoji, inside UNQUOTED labels use only letters, numbers and spaces — no parentheses, quotes, colons, or slashes. (Quoted flowchart/graph labels may contain richer text.)
- mindmap: first line is mindmap, then a root like root((🌱 Topic)), then indented child nodes.
- timeline: first line is timeline, then optional title line, then "period : 🔖 event" rows.

Honesty: never invent facts. If material is provided, base the diagram on it.`;

export async function POST(req: Request) {
  let body: DiagramRequest & { apiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Gemini API key in Settings first." },
      { status: 400 },
    );
  }

  const prompt = buildDiagramPrompt(body);
  if (!prompt) {
    return NextResponse.json(
      { error: "Pick a subject or type a topic first." },
      { status: 400 },
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: DIAGRAM_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the model. Check your connection." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const friendly =
      res.status === 400 || res.status === 403
        ? "The model rejected the request — your Gemini API key may be invalid."
        : "The model is having trouble right now. Try again in a moment.";
    return NextResponse.json({ error: friendly }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text ?? "")
    .join("")
    .trim();

  const outcome = parseDiagramResponse(text ?? "");
  if (!outcome.ok) {
    return NextResponse.json(
      { error: "Couldn't build that diagram. Try rephrasing or regenerate." },
      { status: 502 },
    );
  }

  return NextResponse.json(outcome.result);
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/diagram/route.ts
git commit -m "feat(diagrams): standalone /api/diagram Gemini endpoint"
```

---

## Task 3: Diagrams page (`app/diagrams/page.tsx`)

**Files:**
- Create: `app/diagrams/page.tsx`

(UI page — verified manually in the browser, matching how `/tutor` and other pages are handled in this repo.)

- [ ] **Step 1: Write the page**

Create `app/diagrams/page.tsx`:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, AlertCircle, Network, Sparkles } from "lucide-react";
import { getSettings } from "@/lib/store";
import { useSubjects, type Subject } from "@/lib/cloud-subjects";
import { Puffer } from "@/components/puffer";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { Button } from "@/components/ui/button";
import {
  DIAGRAM_TYPES,
  type DiagramType,
  type DiagramResult,
} from "@/lib/diagram";

const TYPE_LABELS: Record<DiagramType, string> = {
  mindmap: "Mindmap",
  flowchart: "Flowchart",
  timeline: "Timeline",
  graph: "Map",
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

function materialsFor(s: Subject | undefined): string {
  if (!s) return "";
  return [s.cheatsheetMarkdown, s.studyGuideMarkdown]
    .filter((m): m is string => !!m && m.trim().length > 0)
    .join("\n\n");
}

export default function DiagramsPage() {
  const { subjects } = useSubjects();
  const [apiKey, setApiKey] = React.useState<string | null>(null);
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [topic, setTopic] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [result, setResult] = React.useState<DiagramResult | null>(null);

  React.useEffect(() => {
    setApiKey(getSettings().geminiKey);
  }, []);

  const hasKey = !!apiKey;
  const loading = status.kind === "loading";
  const active = (subjects ?? []).filter((s) => !s.archived);
  const selected = active.find((s) => s.id === subjectId);
  const materials = materialsFor(selected);
  const canGenerate = hasKey && (!!topic.trim() || (!!selected && !!materials));

  const generate = React.useCallback(
    async (forceType?: DiagramType) => {
      if (!apiKey || loading) return;
      const body = {
        apiKey,
        subjectName: selected?.name,
        materials: materials || undefined,
        topic: topic.trim() || undefined,
        forceType,
      };
      setStatus({ kind: "loading" });
      try {
        const res = await fetch("/api/diagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as
          | (DiagramResult & { error?: undefined })
          | { error: string }
          | null;
        if (!res.ok || !data || "error" in data) {
          setStatus({
            kind: "error",
            message:
              (data && "error" in data && data.error) ||
              "Something went wrong. Try again.",
          });
          return;
        }
        setResult(data);
        setStatus({ kind: "idle" });
      } catch {
        setStatus({ kind: "error", message: "Couldn't reach the server." });
      }
    },
    [apiKey, loading, selected, materials, topic],
  );

  return (
    <div className="mx-auto flex max-w-[820px] flex-col px-4 py-8 pb-24">
      <header className="mb-5 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <Network className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-ink">Diagrams</h1>
          <p className="text-[13px] text-ink-muted">
            Map out any subject or topic — a mindmap, flowchart, timeline, or
            relationship map you can read at a glance.
          </p>
        </div>
      </header>

      {!hasKey ? (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warn)]/40 bg-[var(--warn)]/8 px-3 py-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--warn)]" strokeWidth={1.75} />
          <p className="text-ink-muted">
            Add your Gemini API key in{" "}
            <Link href="/settings" className="font-semibold text-ink underline">
              Settings
            </Link>{" "}
            to make diagrams.
          </p>
        </div>
      ) : null}

      {/* Controls */}
      <div className="glow-card flex flex-col gap-3 border border-default bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Subject
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="rounded-[10px] border border-default bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="">No subject — freeform</option>
            {active.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
            Topic {selected && materials ? "(optional — blank = overview)" : ""}
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canGenerate) void generate();
            }}
            placeholder='e.g. "the causes of World War 1"'
            className="rounded-[10px] border border-default bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">
            {!hasKey
              ? "Add a Gemini key to begin."
              : !canGenerate
                ? "Type a topic, or pick a subject that has a cheat sheet or study guide."
                : "Ready."}
          </p>
          <Button type="button" disabled={!canGenerate || loading} onClick={() => void generate()}>
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {loading ? "Drawing…" : "Generate"}
          </Button>
        </div>
      </div>

      {status.kind === "error" ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/40 bg-[var(--danger)]/8 px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--danger)]" strokeWidth={1.75} />
          <p className="text-ink">{status.message}</p>
        </div>
      ) : null}

      {/* Empty state */}
      {!result && status.kind !== "loading" ? (
        <div className="mt-8 flex flex-col items-center gap-4 py-8 text-center">
          <Puffer size={96} />
          <p className="max-w-sm text-sm text-ink-muted">
            Pick a subject or type a topic, and I&apos;ll draw it out as a diagram
            you can read and zoom into.
          </p>
        </div>
      ) : null}

      {/* Result */}
      {result ? (
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{result.title || "Diagram"}</h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {DIAGRAM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={loading}
                  onClick={() => void generate(t)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                    result.type === t
                      ? "border-[color:var(--accent)] text-[color:var(--accent-deep)]"
                      : "border-default text-ink-muted hover:text-ink"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <MermaidDiagram code={result.mermaid} />

          {result.key.length > 0 ? (
            <div className="rounded-[12px] border border-default bg-surface-2/40 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">Key</p>
              <ul className="flex flex-col gap-1.5 text-sm text-ink">
                {result.key.map((k, i) => (
                  <li key={i}>
                    <span className="font-semibold">{k.label}</span> — {k.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || !canGenerate}
              onClick={() => void generate(result.type)}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0. (`variant="secondary"` is a real variant in `components/ui/button.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add app/diagrams/page.tsx
git commit -m "feat(diagrams): Diagrams tab page with subject/topic picker + type override"
```

---

## Task 4: Sidebar tab + mobile "More" overflow (`components/sidebar.tsx`)

**Files:**
- Modify: `components/sidebar.tsx` (imports ~line 6-14; `NAV` ~line 24-32; `MobileNav` ~line 109-142)

- [ ] **Step 1: Add the icons to the import**

Change the lucide import block (lines 6-14) so it also imports `Network` and `MoreHorizontal`:

```tsx
import {
  LayoutGrid,
  NotebookPen,
  ClipboardList,
  Layers,
  HelpCircle,
  BookText,
  GraduationCap,
  Network,
  MoreHorizontal,
} from "lucide-react";
```

- [ ] **Step 2: Add the Diagrams nav item**

Append to the `NAV` array (after the Tutor entry, line 31):

```tsx
  { label: "Diagrams", href: "/diagrams", icon: Network, matchPrefix: "/diagrams" },
```

(The desktop `NAV_GROUPS` "Study tools" group is `NAV.slice(3)`, so Diagrams joins it automatically — no other desktop change.)

- [ ] **Step 3: Define the mobile primary set**

Directly below the `NAV_GROUPS` definition (after line 39), add:

```tsx
// Mobile bottom bar shows these four; everything else folds into "More".
const MOBILE_PRIMARY_HREFS = ["/", "/notepad", "/flashcards", "/practice"];
```

- [ ] **Step 4: Replace `MobileNav` with a primary-plus-More version**

Replace the entire `MobileNav` function (lines 109-142) with:

```tsx
export function MobileNav() {
  const isActive = useIsActive();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Close the overflow sheet whenever the route changes.
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const primary = MOBILE_PRIMARY_HREFS.map((href) =>
    NAV.find((n) => n.href === href),
  ).filter((n): n is NavItem => !!n);
  const overflow = NAV.filter((n) => !MOBILE_PRIMARY_HREFS.includes(n.href));
  const overflowActive = overflow.some((item) => isActive(item));

  const linkClass = (activeItem: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 rounded-[10px] px-3 py-2 text-[11px] font-semibold transition-colors ${
      activeItem
        ? "bg-surface-2 text-[color:var(--accent-deep)]"
        : "text-ink-muted active:text-ink"
    }`;

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-default bg-[color:var(--surface)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary navigation"
    >
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 -z-10 cursor-default bg-transparent"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-full inset-x-0 border-t border-default bg-[color:var(--surface)] p-2">
            <div className="mx-auto grid max-w-[420px] grid-cols-4 gap-1">
              {overflow.map((item) => {
                const Icon = item.icon;
                const activeItem = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={activeItem ? "page" : undefined}
                    className={linkClass(activeItem)}
                    style={activeItem ? activeGlow() : undefined}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                    <span className="leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <div className="mx-auto flex max-w-[420px] items-stretch justify-around px-2 py-1.5">
        {primary.map((item) => {
          const Icon = item.icon;
          const activeItem = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeItem ? "page" : undefined}
              className={linkClass(activeItem)}
              style={activeItem ? activeGlow() : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label="More"
          onClick={() => setMoreOpen((o) => !o)}
          className={linkClass(overflowActive || moreOpen)}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
          <span className="leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Verify typecheck + existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests (including `lib/diagram.test.ts`) pass.

- [ ] **Step 6: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat(diagrams): add Diagrams tab + mobile More overflow nav"
```

---

## Task 5: Full verification + manual browser check

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npx next build`
Expected: build succeeds; output lists `/diagrams` and `ƒ /api/diagram`.

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000/diagrams` (sign in if prompted).
Verify:
1. With no Gemini key → the Settings banner shows and Generate is disabled.
2. "No subject — freeform" + a typed topic → Generate draws a diagram with a title, a key, and four type chips; the active type is highlighted.
3. Clicking a different type chip re-renders as that type.
4. Selecting a subject **with** a cheat sheet/study guide and leaving the topic blank → Generate produces an overview from its materials.
5. Selecting a subject **without** materials and no topic → Generate stays disabled with the hint.
6. Click a diagram → the zoom lightbox opens (existing `<MermaidDiagram>` behavior).
7. On a narrow viewport, the bottom bar shows Study Desk · Notepad · Flashcards · Practice · **More**; tapping **More** reveals Assignments · Guides · Tutor · Diagrams.

- [ ] **Step 3: Stop the dev server**

(Stop `next dev` before any later `next build` so they don't share `.next`.)

---

## Self-Review (completed during planning)

- **Spec coverage:** content from subject materials *or* topic (Task 1 `buildDiagramPrompt`, Task 3 controls) ✓; ephemeral/no DB (no migration anywhere) ✓; auto type + override (Task 2 `forceType`, Task 3 chips) ✓; richer nodes + key (Task 2 `DIAGRAM_SYSTEM`, Task 3 key box) ✓; reuse Mermaid renderer (Task 3) ✓; standalone endpoint (Task 2) ✓; input rules (Task 3 `canGenerate`) ✓; error handling — no key / malformed / mermaid-fallback / network (Tasks 2-3) ✓; mobile "More" overflow (Task 4) ✓; tests for both helpers (Task 1) ✓.
- **Placeholders:** none — every code step contains full code; commands have expected output.
- **Type consistency:** `DiagramType`, `DiagramResult`, `DiagramRequest`, `ParseOutcome`, `DIAGRAM_TYPES`, `buildDiagramPrompt`, `parseDiagramResponse` are defined in Task 1 and consumed with the same names/shapes in Tasks 2-3. `Subject.cheatsheetMarkdown` / `studyGuideMarkdown` and `useSubjects()`'s `{ subjects }` match `lib/cloud-subjects.ts`. `getSettings().geminiKey` matches `lib/store.ts`.
- **Button variants verified:** `components/ui/button.tsx` defines `primary | secondary | ghost | outline | danger | link`; Task 3 uses `secondary` for Regenerate (valid).
```
