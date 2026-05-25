import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running practice migration…");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      subject_id  TEXT NOT NULL,
      title       TEXT NOT NULL,
      questions   JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ quizzes table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS quizzes_user_subject_idx
    ON quizzes (user_id, subject_id, created_at DESC)
  `);
  console.log("✓ quizzes index");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      quiz_id       TEXT NOT NULL,
      subject_id    TEXT NOT NULL,
      responses     JSONB NOT NULL DEFAULT '[]'::jsonb,
      topic_acc     JSONB NOT NULL DEFAULT '{}'::jsonb,
      score_total   INT NOT NULL DEFAULT 0,
      score_max     INT NOT NULL DEFAULT 0,
      completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ quiz_attempts table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS quiz_attempts_user_recent_idx
    ON quiz_attempts (user_id, completed_at DESC)
  `);
  console.log("✓ quiz_attempts index");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
