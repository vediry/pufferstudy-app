import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running notepad migration…");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      title       TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ notes table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS notes_user_recent_idx
    ON notes (user_id, updated_at DESC)
  `);
  console.log("✓ notes index");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
