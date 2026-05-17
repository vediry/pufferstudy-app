# Cloud sync — design

**Date:** 2026-05-17
**Status:** Approved, ready to implement
**Scope:** App repo (`vediry/pufferstudy-app`), with one small FAQ update on landing (`vediry/PufferStudy`).

## Goal

Subjects and uploaded files follow the user's account across devices. Signing in on a phone, laptop, or school computer should show the same study desk.

Today the app stores everything in IndexedDB + localStorage, which is per-browser. After this change, the cloud is the source of truth, scoped to each Clerk user.

## Architecture

```
Clerk auth (existing)
  └→ userId
       └→ Postgres (Neon, Vercel Marketplace)
       │    - subjects table
       │    - files table (file metadata + blob URL)
       └→ Vercel Blob storage
            - users/{userId}/subjects/{subjectId}/{fileId}
```

## Database schema

```sql
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  test_label  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subjects_user ON subjects(user_id);

CREATE TABLE files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  blob_url    TEXT NOT NULL,
  blob_path   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_subject ON files(subject_id);
```

`user_id` is the Clerk user ID string (`user_xxx`). Denormalized onto `files` so we can scope queries without a join.

## Blob storage layout

Path pattern: `users/{userId}/subjects/{subjectId}/{fileId}`

- Per-user prefix for organizational clarity; security is enforced at the API layer (every endpoint checks userId ownership), not via path obscurity
- Access mode: `public` — URLs are unguessable enough; we don't need signed URLs for v1
- The original filename is not preserved in the path (kept as caption only, since users rename via the caption field anyway)

## API endpoints

All endpoints sit under `/api/subjects/*` and require Clerk auth (the existing middleware already protects them). Each handler:

1. Read `userId` from `await auth()`
2. Scope queries / mutations to that userId
3. 401 if missing, 403 if userId doesn't own the resource

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/subjects` | List user's subjects |
| POST   | `/api/subjects` | Create a subject (body: `{ name, testLabel? }`) |
| GET    | `/api/subjects/[id]` | Get one subject with its files |
| PATCH  | `/api/subjects/[id]` | Update name / testLabel |
| DELETE | `/api/subjects/[id]` | Delete subject (cascades to files + blob delete) |
| POST   | `/api/subjects/[id]/files` | Upload a file (multipart, returns file metadata) |
| PATCH  | `/api/subjects/[id]/files/[fileId]` | Update caption |
| DELETE | `/api/subjects/[id]/files/[fileId]` | Delete file from subject + blob |

## Client refactor

**Replace** the existing `lib/store.ts` and `lib/db.ts` IndexedDB calls with fetch-based hooks:

- `useSubjects()` → `GET /api/subjects`
- `useSubject(id)` → `GET /api/subjects/[id]`
- `createSubject(input)` → `POST /api/subjects`
- `deleteSubject(id)` → `DELETE /api/subjects/[id]`
- `uploadFile(subjectId, file)` → `POST /api/subjects/[id]/files`
- `updateCaption(subjectId, fileId, caption)` → `PATCH /api/subjects/[id]/files/[fileId]`
- `deleteFile(subjectId, fileId)` → `DELETE /api/subjects/[id]/files/[fileId]`

No SWR / React Query — raw fetch with React `useState` + `useEffect`. Can add a caching library later if needed.

**Optimistic updates** for caption edits and deletes; full refetch for create/upload (to get server-generated IDs and blob URLs).

## /api/generate refactor

Today the client fetches blob data from IndexedDB, base64 encodes it, and sends it inline with the prompt. With cloud-stored files, that pattern still works but means double bandwidth: client downloads from blob, re-uploads to /api/generate.

**Better:** the client sends a list of `fileId`s; the server fetches each file's blob URL from the DB, downloads the bytes from Vercel Blob (very fast, same region), and forwards to Gemini.

Body shape changes from `images: InlineImage[]` to `fileIds: string[]`. The server resolves each fileId → blob_url → fetches → inlines for Gemini.

Server validates that all `fileIds` belong to the authenticated user before fetching.

## Migration of existing local data

On first sign-in after this ships, the dashboard:

1. Checks `localStorage` for a `subjects` key with content
2. Checks `localStorage` for a `pufferstudy_migrated_at` flag
3. If subjects exist AND no migration flag, shows a banner:

   > Found **3 subjects** stored in this browser.
   > Upload them to your account so they appear on other devices?
   > **[Upload]** **[Skip]**

4. **Upload action:** iterates each subject → POST to `/api/subjects` → for each image in IndexedDB: POST to `/api/subjects/[id]/files` with the blob → on success, sets `pufferstudy_migrated_at` flag → reloads dashboard
5. **Skip action:** sets the flag with value "skipped" → never asks again

Edge case: a user with subjects on multiple devices would have to upload from each device separately. That's acceptable — most users have one primary device.

## Landing page FAQ update

The landing's privacy section currently says something like *"without storing your data on any server."* That's no longer accurate. Rewrite to:

> Your subjects and uploaded notes are private to your account, stored securely so they follow you across devices. Your Gemini API key stays in your browser — it's never sent to our servers.

(API keys legitimately stay client-side because the `/api/generate` proxy receives them per-request without storing.)

## Dependencies

App project:
- `@vercel/postgres` — DB access via tagged templates
- `@vercel/blob` — file storage

Both auto-provision env vars (`POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`) when installed via Vercel Marketplace.

## Vercel Marketplace setup (user-driven)

User needs to:

1. Vercel dashboard → `pufferstudy-app` project → **Storage** tab → **Connect Store** → **Neon Postgres**
2. Same project → **Storage** tab → **Connect Store** → **Vercel Blob**
3. Both auto-provision env vars to the project

Cost: $0 on free tier (Neon: 0.5 GB storage + 100 compute hours/month; Blob: 1 GB storage).

## Implementation sequence

1. User connects Neon Postgres + Vercel Blob via dashboard (~5 min)
2. I run the schema migration via `vercel env pull` + a `npm run db:migrate` script (~5 min)
3. I write API endpoints + DB helpers (~30 min)
4. I refactor client to use fetch hooks (~30 min)
5. I add migration banner + flow (~15 min)
6. I refactor `/api/generate` to accept fileIds (~10 min)
7. I update landing FAQ (~5 min)
8. End-to-end test: create subject from device A → sign in on device B → see it (~5 min)

Total: ~1 session for me, ~5 min of dashboard work for you.

## Out of scope

- Real-time updates (websockets / SSE for changes from another device — refresh refetches, that's enough)
- Account deletion / data export — future GDPR concern
- File version history — latest only
- Shared subjects across users — single-user only

## Risks

- **First-deploy migration**: existing users with local data will see the banner. If they click Skip then change their mind, there's no built-in re-trigger. Acceptable for v1.
- **Blob storage cost growth**: if a user uploads many large PDFs, they could exceed the 1 GB free tier. Add per-user storage quota in a future phase. For now, no quota.
- **DB connection limits**: Neon's free tier has connection limits. Use `@vercel/postgres` which pools connections. Should be fine at low traffic.
- **Cross-region latency**: Neon US-East + Vercel Blob US-East matches Vercel function region (iad1). Same region = fast.
