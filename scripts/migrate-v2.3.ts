// scripts/migrate-v2.3.ts
// Env vars are loaded by `node --env-file=.env.local` in the npm script.
import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running v2.3 migrations…");

  // activity_log — must use sql.query() (tagged template silently swallows DDL).
  await sql.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id            BIGSERIAL PRIMARY KEY,
      user_id       TEXT NOT NULL,
      subject_id    TEXT,
      event_type    TEXT NOT NULL,
      event_data    JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ activity_log table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS activity_log_user_recent_idx
    ON activity_log (user_id, created_at DESC)
  `);
  console.log("✓ activity_log index");

  // archived flag on subjects (idempotent — IF NOT EXISTS).
  await sql.query(`
    ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false
  `);
  console.log("✓ subjects.archived column");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
