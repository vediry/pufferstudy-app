// scripts/migrate-chat-messages.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { sql } from "@vercel/postgres";

async function main() {
  console.log("Adding chat_messages column to subjects...");

  // MUST use sql.query() for DDL. The tagged template silently no-ops.
  const result = await sql.query(
    `ALTER TABLE subjects
       ADD COLUMN IF NOT EXISTS chat_messages JSONB NOT NULL DEFAULT '[]'::jsonb`,
  );
  console.log("ALTER returned:", result.command, "rowCount:", result.rowCount);

  // Verify the column exists
  const check = await sql.query(
    `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'subjects' AND column_name = 'chat_messages'`,
  );
  console.log("Verification:", check.rows);

  if (check.rows.length === 0) {
    console.error("FAIL: chat_messages column not found after ALTER.");
    process.exit(1);
  }
  console.log("OK: chat_messages column exists.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
