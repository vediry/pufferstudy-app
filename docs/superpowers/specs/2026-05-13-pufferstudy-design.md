# PufferStudy — Design Spec

**Date:** 2026-05-13
**Status:** Approved (brainstorming phase)
**Author:** lachmcd2010 + Claude

## Goal

A clean, student-friendly web app where students upload photos of homework, notes, and packets for a subject over time, and the app turns them into an organized cheat sheet before a test. Includes optional AI features (cheat sheet generation, homework chat, practice questions) powered by the student's own Google Gemini API key.

## Non-goals

- No backend database, no user accounts, no auth, no multi-device sync.
- No real OCR pipeline of our own — we offload reading photos to Gemini's vision model.
- No support for OpenAI, Anthropic, or other providers in v1 (clean addition later).
- No e2e test framework, no CI/CD beyond Vercel's default.
- No mobile app — responsive web only.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** for components
- **Vercel** deployment (Hobby tier, free)
- **IndexedDB** for image blob storage (via thin wrapper, no library)
- **localStorage** for metadata (subjects, settings, captions, generated content)
- **Google Gemini API** for AI features (server-proxied)
- **Vitest** for unit tests on pure functions and the API route

## Architecture

Single Next.js app deployed to Vercel. All persistence is client-side. The only server code is one API route (`/api/generate`) that exists purely to proxy AI requests so the student's browser never has to talk to `googleapis.com` directly — this is the key design choice that maximizes compatibility with school network filters on Chromebooks.

### Server-proxy AI flow

1. Student stores their Gemini API key in their own browser (localStorage).
2. When generating, browser reads images from IndexedDB, base64-encodes them, and POSTs `{ apiKey, mode, images, captions, ... }` to `/api/generate`.
3. The route handler forwards to Gemini's `generateContent` endpoint server-side, streams the response back via a `ReadableStream`.
4. Key is held in request memory only — never logged, never persisted.
5. School filters only see traffic to `pufferstudy.vercel.app`, not to any AI provider domain.

`mode` is one of `cheatsheet | chat | practice`. Same endpoint, different system prompts pulled from `lib/prompts.ts`.

**Runtime:** Node.js (`export const runtime = "nodejs"`). Edge runtime is rejected because it has the same 4.5MB body limit but a stricter Web API surface, with no upside for this use case.

## File structure

```
pufferstudy/
├── app/
│   ├── layout.tsx                  Root layout, theme provider, global toaster
│   ├── page.tsx                    Dashboard: subjects + upcoming tests
│   ├── globals.css                 Tailwind + print stylesheet
│   ├── subjects/
│   │   ├── new/page.tsx            Create new subject (name, test date, optional unit)
│   │   └── [id]/
│   │       ├── page.tsx            Subject view: images grid, captions, actions
│   │       ├── cheatsheet/page.tsx Generated cheat sheet view (print-friendly)
│   │       └── chat/page.tsx       Homework chat helper for this subject
│   ├── settings/page.tsx           Gemini API key entry + theme + how-to-get-a-key
│   └── api/
│       └── generate/route.ts       Server-proxy endpoint for all AI calls
├── components/
│   ├── subject-card.tsx            Dashboard tile with days-until-test
│   ├── image-uploader.tsx          File picker + drag-drop, multi-select
│   ├── image-grid.tsx              Grid of uploaded images with caption inputs
│   ├── cheatsheet-view.tsx         Renders generated markdown, print-friendly
│   ├── chat-panel.tsx              Streaming chat UI scoped to one subject
│   ├── practice-quiz.tsx           Generated practice questions with reveal
│   ├── theme-toggle.tsx            Light/dark switcher
│   └── ui/                         shadcn primitives
├── lib/
│   ├── db.ts                       IndexedDB wrapper: putImage, getImage, deleteImage
│   ├── store.ts                    localStorage helpers + typed schema
│   ├── gemini-client.ts            Browser-side: builds request, calls /api/generate
│   ├── prompts.ts                  System prompts for cheatsheet / chat / practice
│   └── utils.ts                    Date math, cn() helper
├── types.ts                        Subject, ImageRef, ChatMessage, etc.
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

### Boundary rule

Components never touch IndexedDB or localStorage directly — only through `lib/db.ts` and `lib/store.ts`. This makes both testing and a future swap-to-real-backend trivial.

## Data model

```ts
type Subject = {
  id: string;              // uuid
  name: string;            // "Biology - Chapter 8"
  testDate: string | null; // ISO date, null if no test scheduled
  testLabel?: string;      // "Unit 6 Quiz" — optional human label
  createdAt: string;
  imageIds: string[];      // ordered list of IndexedDB keys
  captions: Record<string, string>;  // imageId -> caption text
  cheatSheet?: { markdown: string; generatedAt: string };
  chatHistory?: ChatMessage[];
  practice?: { questions: PracticeQ[]; generatedAt: string };
};

type ChatMessage = { role: "user" | "assistant"; content: string; ts: string };
type PracticeQ   = { q: string; a: string };
type ImageRef    = { id: string; blob: Blob; mimeType: string; addedAt: string };
type Settings    = { geminiKey: string | null; theme: "light" | "dark" | "system" };
```

**localStorage keys:**
- `pufferstudy:subjects` → `Subject[]`
- `pufferstudy:settings` → `Settings`

**IndexedDB:** database `pufferstudy`, object store `images`, keyPath `id`. Blobs live only here.

## Data flows

### Upload images to a subject

1. User picks files in `image-uploader.tsx`.
2. Resize client-side to max 1024px long edge, re-encode JPEG q=0.75. Target ~100KB per image. This is mandatory, not "only if over 4MB" — we need small images to stay under Vercel's 4.5MB serverless body limit when generating.
3. For each file: generate uuid → `db.putImage({id, blob, mimeType, addedAt})` → push id into `subject.imageIds` in localStorage.
4. Parent re-renders, fetches blobs by id, shows previews via `URL.createObjectURL`.

### Generate cheat sheet

1. User clicks "Generate Cheat Sheet" on a subject page.
2. Frontend loads all `imageIds` from the subject → reads blobs from IndexedDB → base64-encodes each.
3. POSTs to `/api/generate` with `{ apiKey, mode: "cheatsheet", images, captions, subjectName, testLabel }`.
4. Server route picks the cheat-sheet prompt, calls Gemini `generateContent` with inline image parts, streams response back.
5. Frontend renders streaming markdown into `cheatsheet-view.tsx`, then writes final result to `subject.cheatSheet` in localStorage.

### Homework chat

- Same endpoint, `mode: "chat"`, body also includes `chatHistory`.
- Server prompt: "Answer using these notes as context."
- Streams reply, frontend appends to `subject.chatHistory`.

### Practice questions

- `mode: "practice"`, server prompt asks for JSON output `{ questions: [{q, a}, ...] }`.
- Frontend parses, stores in `subject.practice`. Quiz UI reveals answers on click.

### Dashboard test countdown

- Pure function in `lib/utils.ts` computes days-until-test on render.
- ≤ 3 days → red badge, ≤ 7 days → amber, otherwise neutral. Past-due tests show with a "past" badge.

## Error handling

| Scenario | Behavior |
|---|---|
| No API key set | Generate buttons disabled with tooltip pointing to Settings |
| Gemini returns 401/403 | Route returns 401 `{error: "invalid_key"}`; UI toasts and clears bad key |
| No images in subject | Generate buttons disabled until ≥ 1 image uploaded |
| Gemini errors mid-stream | Route returns 502 `{error: "gemini_failed"}`; UI toasts, prior cheat sheet preserved |
| Network failure / school filter | UI shows "Couldn't reach PufferStudy server. Check your connection." |
| IndexedDB unavailable | Uploader shows "Your browser is blocking storage. Try a different browser or exit private mode." App still works for viewing existing subjects. |
| Any image upload | Auto-resized client-side to ~100KB before storage |
| > 25 images per generation | UI warns and asks student to remove some (keeps request under Vercel's 4.5MB serverless body limit) |
| Request body > 4MB | Frontend catches before sending, shows "Too many large images — try selecting fewer" |
| Corrupted localStorage | `lib/store.ts` validates on read; falls back to empty if invalid |
| Concurrent generation | Generate button disabled per-subject while in flight |
| Delete subject | Confirmation dialog → removes blobs + metadata |
| Delete image | No confirmation; removes blob + caption + id |

### API key safety

- Settings page warns: "Your key stays in this browser. Don't paste keys you wouldn't lose."
- Key input is `type="password"` with a show/hide toggle.
- Route handler never logs request body or headers. No accidental `console.log(req)`.
- Key is read from request body, used in the outbound Gemini fetch, and discarded.

## Features included

**Core:**
- Dashboard with subject tiles and days-until-test (red ≤ 3, amber ≤ 7).
- Create new subject (name + test date + optional unit label).
- Upload multiple images to existing subject; auto-resize to ~100KB on upload.
- Per-image caption input.
- Generate cheat sheet from photos using Gemini Vision.
- Homework chat panel scoped to one subject's notes.
- Auto-generated practice questions.
- Delete subject / delete image.
- Print-friendly cheat sheet view with two action buttons that both invoke `window.print()` — labeled "Print" and "Save as PDF" so the student understands they can do either. The print stylesheet hides app chrome and renders only the cheat sheet content.
- Dark / light mode toggle.
- Settings page: paste Gemini API key, with instructions for getting one free.

**Explicitly NOT in v1:** real-time sync, accounts, multi-provider AI dropdown, mobile app, OCR fallback when no key is set.

## Testing approach

- **Unit tests (Vitest):**
  - `lib/utils.ts` — date math, badge thresholds.
  - `lib/store.ts` — schema validation on read.
  - `lib/prompts.ts` — prompt builders produce expected structure.
- **API route test (Vitest + mocked fetch):**
  - `app/api/generate/route.ts` — mode routing, 401 on missing key, 502 on Gemini error, no key leakage in error responses.
- **Manual smoke test checklist** for UI flows (upload → generate → print → delete).
- No e2e framework. Premature for this scope.

## Open follow-ups (post-MVP)

- Add OpenAI / Claude as alternative providers via settings dropdown.
- Real-time sync (would need a real backend — Supabase or similar).
- PDF export with custom layout (not just browser print).
- Per-image highlight / annotation tools.
- Share a cheat sheet via link.
