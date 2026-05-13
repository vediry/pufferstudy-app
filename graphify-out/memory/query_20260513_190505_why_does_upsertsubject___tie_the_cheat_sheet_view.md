---
type: "query"
date: "2026-05-13T19:05:05.242212+00:00"
question: "Why does upsertSubject() tie the Cheat Sheet view to four other communities — is it the de-facto write path for every subject mutation?"
contributor: "graphify"
source_nodes: ["upsertSubject", "NewSubjectPage.onSubmit", "SubjectPage.update", "CheatsheetPage.start", "Boundary rule (components never touch storage)"]
---

# Q: Why does upsertSubject() tie the Cheat Sheet view to four other communities — is it the de-facto write path for every subject mutation?

## Answer

Yes. upsertSubject() in lib/store.ts:42 is called from exactly three places: NewSubjectPage.onSubmit (creates), SubjectPage.update (every photo/caption/delete change), and CheatsheetPage.start (saves streamed markdown via onDone). All five graph edges from upsertSubject are EXTRACTED. Because upsertSubject sits in the Storage community while its callers are in New Subject Form, Dashboard, Image Upload, and Cheat Sheet Streaming View, it functions as the single write boundary. The spec's INFERRED 'Boundary rule (components never touch storage)' rationale_for edge confirms this is by design. Cheatsheet auto-persistence happens because CheatsheetPage.start.onDone calls upsertSubject — no separate save button needed.

## Source Nodes

- upsertSubject
- NewSubjectPage.onSubmit
- SubjectPage.update
- CheatsheetPage.start
- Boundary rule (components never touch storage)