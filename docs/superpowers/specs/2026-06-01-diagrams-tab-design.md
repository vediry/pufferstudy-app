# Diagrams / Map-out tab — design spec

**Date:** 2026-06-01
**Status:** Design approved in brainstorm; ready for implementation plan.
**Author:** brainstormed with the user (PufferStudy maintainer).

## Summary

A new standalone **Diagrams** tab that turns any subject — or any typed topic —
into a single, readable visual map (mindmap / flowchart / timeline / relationship
graph). It is a *visualization* surface, deliberately **separate from the Tutor**
(which is conversational and teaches). The Tutor helps you *learn*; Diagrams lets
you *see* a topic at a glance.

Diagrams are **ephemeral**: generate → view → zoom → regenerate. Nothing is
persisted; refreshing the page clears the current diagram. No database table, no
migration.

## Goals

- Pick a subject and generate a diagram from its existing materials (cheat sheet +
  study guide), **or** type a free-text topic and map that from scratch.
- The AI auto-picks the best diagram type for the topic, with a one-click
  **override** to re-render as a different type.
- Diagrams are **self-explanatory**: richer nodes (a title + a one-line description
  per box) plus a short **key** beneath the diagram. A student can read everything
  and understand it without extra explanation.
- Reuse the existing Mermaid renderer that shipped with the Tutor.

## Non-goals (YAGNI)

- **No persistence / saved library.** Ephemeral only.
- **No new DB table or migration.**
- **No image generation or web image search** (explicitly scratched earlier —
  Gemini can't browse and hallucinates image URLs).
- **No multi-diagram canvas / decks.** One diagram at a time.
- **Not merged into the Tutor.** Separate tab, separate endpoint.

## Approaches considered

**Endpoint architecture (the one real fork):**

1. **Standalone `/api/diagram` route (CHOSEN).** Mirrors the just-shipped
   `/api/tutor`: a small, self-contained, non-streaming Gemini endpoint with its
   own server-side system prompt. Keeps the experiment independent of the
   production `/api/generate` cheat-sheet/study-guide pipeline, so it can evolve or
   be removed without risk. Consistent with how the Tutor was built.
2. *Add a `diagram` mode to `/api/generate`.* The roadmap's stated principle is
   "new AI tools become modes on `/api/generate`, not new routes." More
   consistent long-term, but `/api/generate` is the prod content pipeline and this
   feature is new/ephemeral. **Rejected for now** — revisit consolidating later if
   Diagrams proves itself, same as we may eventually fold in the Tutor.

**Locked product decisions (from brainstorm):**

- Content source = **both** (subject materials *or* typed topic).
- Persistence = **ephemeral**.
- Diagram type = **AI auto-picks, with override**.
- Info richness = **richer nodes + key** (the "A+B" mock).

## Architecture

```
app/diagrams/page.tsx          # the tab (client): picker + topic input + result
app/api/diagram/route.ts       # standalone non-streaming Gemini endpoint
lib/diagram.ts                 # PURE helpers: buildDiagramPrompt + parseDiagramResponse + types
lib/diagram.test.ts            # unit tests for the pure helpers
components/mermaid-diagram.tsx # REUSED as-is (already in prod)
components/sidebar.tsx         # add "Diagrams" tab to the Study tools group
```

### Data flow

1. Page loads subjects via `useSubjects()` (`lib/cloud-subjects`) and the Gemini
   key via `getSettings().geminiKey` (`lib/store`) — same gate as the Tutor.
2. User selects a subject (or "No subject — freeform") and/or types a topic, then
   hits **Generate**.
3. Page POSTs to `/api/diagram` with:
   ```ts
   {
     apiKey: string,
     subjectName?: string,
     materials?: string,   // cheatsheetMarkdown + studyGuideMarkdown, joined; omitted if none
     topic?: string,       // the typed topic, if any
     forceType?: DiagramType // set only when the user clicks an override chip
   }
   ```
4. The route builds the prompt (`buildDiagramPrompt`), calls Gemini
   (`generateContent`, non-streaming, `responseMimeType: "application/json"`),
   then normalizes the reply with `parseDiagramResponse`.
5. Route responds with:
   ```ts
   {
     type: DiagramType,            // "mindmap" | "flowchart" | "timeline" | "graph"
     title: string,               // short heading shown above the diagram
     mermaid: string,             // the fenced-block body (no ``` fences)
     key: { label: string; text: string }[]  // the explanatory key (A+B)
   }
   ```
6. Page renders `<MermaidDiagram code={mermaid} />`, the title, the key box, the
   four type-override chips (active type highlighted), and Regenerate.

`DiagramType = "mindmap" | "flowchart" | "timeline" | "graph"`.

### Input rules

- **Subject + no topic:** generate an overview *from the subject's materials*. If
  the subject has no cheat sheet/study guide, the Generate button stays disabled
  with a hint ("Type a topic, or generate this subject's cheat sheet first").
- **Subject + topic:** map the typed topic, grounded by the subject's materials as
  context.
- **No subject + topic:** map the topic from scratch (freeform).
- **No subject + no topic:** Generate disabled.

### The system prompt (`DIAGRAM_SYSTEM`)

Reuses the Mermaid safety rules already proven in the Tutor prompt, plus:

- Produce **exactly one** diagram for the request.
- **Auto-select** the type from the topic wording (timeline → events over time;
  flowchart → process/steps; mindmap → overview/"map out"; graph → relationships) —
  **unless `forceType` is given**, in which case use that type.
- **Richer nodes:** for `flowchart`/`graph`, each node is a **quoted** label with a
  short title, a `<br/>` line break, then a one-line description (quoted labels +
  `<br/>` are required so punctuation doesn't break parsing). For
  `mindmap`/`timeline` (stricter about multiline), keep nodes short and put the
  detail in the **key** instead.
- Always also return a **key**: 3–6 `{label, text}` entries explaining the main
  parts in plain language.
- Keep it focused: ~6–12 nodes, emoji-led labels matched to the subject, no
  punctuation in unquoted labels (the existing rules).
- Output **strict JSON** matching the response shape (enforced via
  `responseMimeType` + a tolerant parser fallback).

### Navigation

- **Desktop:** add a **Diagrams** entry (lucide `Network` icon) to the **Study
  tools** group in `components/sidebar.tsx`. Trivial one-line `NAV` addition.
- **Mobile:** the bottom bar is already at 7 items after the Tutor shipped; adding
  Diagrams makes **8**, which won't fit the single-row `MobileNav`. As part of this
  work, change `MobileNav` to keep **4 primary tabs visible** + a **"More"** entry
  (a small bottom sheet / popover listing the rest). Proposed split — visible:
  Study Desk · Notepad · Flashcards · Practice; under More: Assignments · Guides ·
  Tutor · Diagrams — to be confirmed when writing the plan. This is in-scope
  precisely because this feature forces it. Desktop grouped sidebar is unaffected.

## Error handling

- **No Gemini key:** same gated banner as the Tutor — link to `/settings`, Generate
  disabled.
- **Model returns non-JSON / malformed:** `parseDiagramResponse` returns a typed
  error; page shows a friendly "Couldn't build that diagram — try rephrasing or
  Regenerate" message.
- **Valid JSON but Mermaid won't parse:** `<MermaidDiagram>` already falls back to
  showing the raw code; the page additionally surfaces a Regenerate button.
- **Network / Gemini 4xx-5xx:** mirror the Tutor route's friendly messages (invalid
  key vs. transient model error).
- **No subject + no topic, or subject-without-materials + no topic:** Generate
  disabled with an inline hint (no request fired).

## Testing

Unit tests in `lib/diagram.test.ts` (vitest, mirrors `lib/spaced-repetition.test.ts`):

- `buildDiagramPrompt`:
  - includes the typed topic when present;
  - includes the subject name + materials when present;
  - injects the `forceType` instruction only when `forceType` is set;
  - omits materials cleanly when the subject has none.
- `parseDiagramResponse`:
  - parses a well-formed JSON reply into the typed result;
  - tolerates ```json-fenced output and surrounding whitespace;
  - defaults/repairs a missing or invalid `type` to a safe value;
  - returns a typed error (not a throw) on unparseable input;
  - coerces a missing `key` to `[]` rather than crashing.

No DB and no network in tests — the helpers are pure. The route stays a thin
wrapper around them (consistent with the rest of the app).

## Open follow-ups (out of scope here)

- Consolidating `/api/diagram` (and `/api/tutor`) into `/api/generate` later, if the
  features stick.
- Optional "download diagram as PNG/SVG" — nice-to-have, not in v1.
- The anti-cheat tutor guardrail remains separately deferred (see the tutor
  guardrail note); unrelated to this tab.
