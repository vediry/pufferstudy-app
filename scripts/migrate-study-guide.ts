import { sql } from "@vercel/postgres";

async function main() {
  console.log("Running study-guide migration…");

  await sql.query(`
    ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS study_guide_markdown TEXT
  `);
  console.log("✓ subjects.study_guide_markdown column");

  await sql.query(`
    ALTER TABLE subjects
    ADD COLUMN IF NOT EXISTS study_guide_generated_at TIMESTAMPTZ
  `);
  console.log("✓ subjects.study_guide_generated_at column");

  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
