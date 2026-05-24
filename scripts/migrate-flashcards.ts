import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running flashcards migration…");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL,
      subject_id    TEXT NOT NULL,
      title         TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ flashcard_decks table");

  // One deck per (user, subject). Regeneration replaces the deck.
  await sql.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS flashcard_decks_user_subject_uniq
    ON flashcard_decks (user_id, subject_id)
  `);
  console.log("✓ flashcard_decks unique index");

  await sql.query(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id            TEXT PRIMARY KEY,
      deck_id       TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      front         TEXT NOT NULL,
      back          TEXT NOT NULL,
      position      INT  NOT NULL DEFAULT 0,
      ease          REAL NOT NULL DEFAULT 2.5,
      interval_days INT  NOT NULL DEFAULT 0,
      due_date      DATE NOT NULL DEFAULT CURRENT_DATE,
      reviews       INT  NOT NULL DEFAULT 0,
      last_grade    INT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log("✓ flashcards table");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS flashcards_deck_position_idx
    ON flashcards (deck_id, position)
  `);
  console.log("✓ flashcards index");

  await sql.query(`
    CREATE INDEX IF NOT EXISTS flashcards_user_due_idx
    ON flashcards (user_id, due_date)
  `);
  console.log("✓ flashcards due index");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
