import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running assignments migration…");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      due_date     DATE,
      status       TEXT NOT NULL DEFAULT 'todo',
      completed_at TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ assignments table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS assignments_user_due_idx
    ON assignments (user_id, due_date)
  `);
  console.log("✓ assignments index");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
