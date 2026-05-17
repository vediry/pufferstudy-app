import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot schema migration. Uses IF NOT EXISTS, so safe to run repeatedly.
// Remove this file once tables are confirmed in place.
export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS subjects (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        name        TEXT NOT NULL,
        test_label  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id)`;
    await sql`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS test_date DATE`;
    await sql`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS cheatsheet_markdown TEXT`;
    await sql`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS cheatsheet_generated_at TIMESTAMPTZ`;

    await sql`
      CREATE TABLE IF NOT EXISTS files (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        user_id     TEXT NOT NULL,
        blob_url    TEXT NOT NULL,
        blob_path   TEXT NOT NULL,
        mime_type   TEXT NOT NULL,
        caption     TEXT NOT NULL DEFAULT '',
        position    INTEGER NOT NULL DEFAULT 0,
        added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_files_subject ON files(subject_id)`;

    const { rows } = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('subjects', 'files')
      ORDER BY table_name
    `;

    return NextResponse.json({
      ok: true,
      tables: rows.map((r) => r.table_name),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
