# Graph Report - C:/Users/spexr/pufferstudy  (2026-05-13)

## Corpus Check
- Corpus is ~9,984 words - fits in a single context window. You may not need a graph.

## Summary
- 253 nodes · 420 edges · 32 communities (15 shown, 17 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.89)
- Token cost: 141,722 input · 25,008 output

## Community Hubs (Navigation)
- [[_COMMUNITY_UI Primitives (shadcn-style)|UI Primitives (shadcn-style)]]
- [[_COMMUNITY_Dashboard & Subject Tiles|Dashboard & Subject Tiles]]
- [[_COMMUNITY_Gemini API Proxy Route|Gemini API Proxy Route]]
- [[_COMMUNITY_Cheat Sheet Streaming View|Cheat Sheet Streaming View]]
- [[_COMMUNITY_Storage + Spec Rationale|Storage + Spec Rationale]]
- [[_COMMUNITY_IndexedDB & Body Limits|IndexedDB & Body Limits]]
- [[_COMMUNITY_Root Layout & Font Loading|Root Layout & Font Loading]]
- [[_COMMUNITY_Image Upload Flow|Image Upload Flow]]
- [[_COMMUNITY_Top-level Architecture|Top-level Architecture]]
- [[_COMMUNITY_New Subject Form|New Subject Form]]
- [[_COMMUNITY_App Metadata & Fonts|App Metadata & Fonts]]
- [[_COMMUNITY_Theme System|Theme System]]
- [[_COMMUNITY_Form Labels + Utilities|Form Labels + Utilities]]
- [[_COMMUNITY_Design Tokens (Notebook)|Design Tokens (Notebook)]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Icon & Anti-pattern Rules|Icon & Anti-pattern Rules]]
- [[_COMMUNITY_Ambient TS Types|Ambient TS Types]]
- [[_COMMUNITY_Next reactStrictMode|Next reactStrictMode]]
- [[_COMMUNITY_PostCSS Tailwind v4|PostCSS Tailwind v4]]
- [[_COMMUNITY_Header Component|Header Component]]
- [[_COMMUNITY_Cheatsheet Prompt Builder|Cheatsheet Prompt Builder]]
- [[_COMMUNITY_Chat Prompt Builder|Chat Prompt Builder]]
- [[_COMMUNITY_Practice Prompt Builder|Practice Prompt Builder]]
- [[_COMMUNITY_UUID Helper|UUID Helper]]
- [[_COMMUNITY_Typography Token|Typography Token]]
- [[_COMMUNITY_Spacing Scale Token|Spacing Scale Token]]
- [[_COMMUNITY_Radius Tokens|Radius Tokens]]
- [[_COMMUNITY_Motion  Reduced-motion|Motion / Reduced-motion]]
- [[_COMMUNITY_Tech Stack Note|Tech Stack Note]]
- [[_COMMUNITY_Open Follow-ups|Open Follow-ups]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 30 edges
2. `upsertSubject()` - 9 edges
3. `generate (gemini-client)` - 9 edges
4. `getSettings()` - 8 edges
5. `Generate API POST Handler` - 8 edges
6. `SubjectPage` - 8 edges
7. `Subject` - 7 edges
8. `Button` - 7 edges
9. `getSubjects()` - 7 edges
10. `CheatsheetPage` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Error handling matrix` --rationale_for--> `generate (gemini-client)`  [INFERRED]
  docs/superpowers/specs/2026-05-13-pufferstudy-design.md → lib/gemini-client.ts
- `Node.js runtime over Edge` --rationale_for--> `generate (gemini-client)`  [INFERRED]
  docs/superpowers/specs/2026-05-13-pufferstudy-design.md → lib/gemini-client.ts
- `Generate cheat sheet flow` --rationale_for--> `generate (gemini-client)`  [INFERRED]
  docs/superpowers/specs/2026-05-13-pufferstudy-design.md → lib/gemini-client.ts
- `Boundary rule (components never touch storage)` --rationale_for--> `getSubjects`  [INFERRED]
  docs/superpowers/specs/2026-05-13-pufferstudy-design.md → lib/store.ts
- `Forms rules (labels, errors, a11y)` --rationale_for--> `Label component`  [INFERRED]
  docs/design-system/MASTER.md → components/ui/label.tsx

## Hyperedges (group relationships)
- **BYO-key Gemini Generation Pipeline** — settings_SettingsPage, concept_byokGeminiKey, route_generatePOST, route_GeminiUpstream [INFERRED 0.85]
- **Gemini SSE -> Plain Text Streaming Flow** — route_generatePOST, route_GeminiUpstream, route_SSEStreamProxy [EXTRACTED 0.95]
- **Subject Aggregate Data Model** — types_Subject, types_ChatMessage, types_PracticeQ, types_ImageRef [EXTRACTED 0.95]
- **Cheatsheet streaming generation flow** — cheatsheet_page_CheatsheetPage, cheatsheet_page_start, lib_gemini_client_generate, cheatsheet_view_CheatsheetView, cheatsheet_page_GenState [INFERRED 0.95]
- **Image upload-display-delete lifecycle** — image_uploader_ImageUploader, image_grid_item_ImageGridItem, subject_page_SubjectPage, lib_db_putImage, lib_db_getImage, lib_db_deleteImage [INFERRED 0.95]
- **Subject CRUD across pages** — new_page_NewSubjectPage, subject_page_SubjectPage, lib_store_upsertSubject, lib_store_getSubject, lib_store_deleteSubject, concept_subject_model [INFERRED 0.95]
- **shadcn-style UI primitives sharing cn+forwardRef pattern** — button_component, card_component, input_component, badge_component, lib_utils_cn, shadcn_ui_pattern [INFERRED 0.85]
- **Subject test-date countdown pipeline** — subject_card_component, lib_utils_daysUntil, lib_utils_countdownTone, lib_utils_countdownLabel, badge_component, badge_tone_type [EXTRACTED 1.00]
- **App-wide theme switching flow** — theme_provider_component, theme_toggle_component, next_themes_lib, theme_toggle_mode_cycle, theme_toggle_mounted_guard [INFERRED 0.95]
- **AI generation pipeline (browser->proxy->Gemini)** — gemini_client_generate, db_getImage, prompts_systemPromptFor, spec_server_proxy_ai_flow [INFERRED 0.95]
- **Client-side persistence layer (IndexedDB + localStorage)** — db_putImage, store_upsertSubject, store_isValidSubject, spec_boundary_rule [INFERRED 0.85]
- **Test-countdown pipeline (date -> tone -> badge)** — utils_daysUntil, utils_countdownTone, utils_countdownLabel, design_master_countdown_badge [INFERRED 0.95]

## Communities (32 total, 17 thin omitted)

### Community 0 - "UI Primitives (shadcn-style)"
Cohesion: 0.09
Nodes (33): Badge (tone-pill UI primitive), Badge Tone (neutral/danger/warning/success/past), Button (forwardRef + asChild Slot), buttonVariants (cva variant/size matrix), Card primitive set, CardContent, CardDescription, CardFooter (+25 more)

### Community 1 - "Dashboard & Subject Tiles"
Cohesion: 0.16
Nodes (15): DashboardEmptyState(), ImageGridItem(), Props, SubjectCard(), SubjectPage(), countdownLabel(), CountdownTone, daysUntil() (+7 more)

### Community 2 - "Gemini API Proxy Route"
Cohesion: 0.14
Nodes (20): bad(), Body, InlineImage, POST(), blobToBase64(), generate(), GenerateInput, StreamHandlers (+12 more)

### Community 3 - "Cheat Sheet Streaming View"
Cohesion: 0.15
Nodes (19): CheatsheetPage, GenState (idle|loading|done|error), GenState, CheatsheetPage.start, CheatsheetView, CheatsheetView(), AbortController generation cleanup, Print/Save-as-PDF Export (+11 more)

### Community 4 - "Storage + Spec Rationale"
Cohesion: 0.11
Nodes (23): putImage, resizeImageBlob, Test-countdown badge spec, API key safety, Boundary rule (components never touch storage), Dashboard test countdown logic, Data model (Subject, ImageRef, ChatMessage), Error handling matrix (+15 more)

### Community 5 - "IndexedDB & Body Limits"
Cohesion: 0.1
Nodes (21): pufferstudy IndexedDB database, deleteImage, getImage, openDb (IndexedDB), Print stylesheet (cheat sheet), MAX_BODY_BYTES (4MB cap), StreamHandlers, blobToBase64 (+13 more)

### Community 6 - "Root Layout & Font Loading"
Cohesion: 0.14
Nodes (12): metadata, splineSans, splineSansMono, viewport, Header(), PufferLogo(), ThemeProvider(), ICONS (+4 more)

### Community 7 - "Image Upload Flow"
Cohesion: 0.17
Nodes (15): ImageUploader(), Props, Subject Data Model, DashboardEmptyState, PufferIllustration, ImageUploader.handleFiles, deleteImage(), getImage() (+7 more)

### Community 8 - "Top-level Architecture"
Cohesion: 0.15
Nodes (16): BYO Gemini API Key (browser-local), Client-side localStorage Store, Multimodal Notes-to-Cheatsheet Flow, Dashboard Page (Subjects List), SubjectSkeletonGrid, Gemini streamGenerateContent SSE Upstream, GenerateMode (cheatsheet/chat/practice), SSE-to-PlainText Stream Proxy (+8 more)

### Community 9 - "New Subject Form"
Cohesion: 0.32
Nodes (8): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Input, Label

### Community 10 - "App Metadata & Fonts"
Cohesion: 0.4
Nodes (5): RootLayout Component, App Metadata (PufferStudy), Spline Sans Font, Spline Sans Mono Font, Viewport Theme Colors

### Community 11 - "Theme System"
Cohesion: 0.5
Nodes (5): next-themes library, ThemeProvider (next-themes wrapper), ThemeToggle (light/dark/system cycle), Tri-state theme cycle (light->dark->system), Hydration-safe mounted guard

### Community 12 - "Form Labels + Utilities"
Cohesion: 0.67
Nodes (3): Forms rules (labels, errors, a11y), Label component, cn (className merger)

### Community 13 - "Design Tokens (Notebook)"
Cohesion: 0.67
Nodes (3): Elevation / shadow tokens, Notebook design direction, Palette tokens (puffer/surface/text/semantic)

## Knowledge Gaps
- **87 isolated node(s):** `nextConfig`, `config`, `PracticeQ`, `splineSans`, `splineSansMono` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `UI Primitives (shadcn-style)` to `Dashboard & Subject Tiles`, `Cheat Sheet Streaming View`, `Root Layout & Font Loading`, `Image Upload Flow`, `New Subject Form`, `Theme System`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `SubjectPage` connect `UI Primitives (shadcn-style)` to `Cheat Sheet Streaming View`, `Image Upload Flow`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `upsertSubject()` connect `Cheat Sheet Streaming View` to `UI Primitives (shadcn-style)`, `New Subject Form`, `Dashboard & Subject Tiles`, `Image Upload Flow`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `generate (gemini-client)` (e.g. with `Server-proxy AI flow` and `Node.js runtime over Edge`) actually correct?**
  _`generate (gemini-client)` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Generate API POST Handler` (e.g. with `Multimodal Notes-to-Cheatsheet Flow` and `BYO Gemini API Key (browser-local)`) actually correct?**
  _`Generate API POST Handler` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `nextConfig`, `config`, `PracticeQ` to the rest of the system?**
  _87 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Primitives (shadcn-style)` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._