import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic: list columns of subjects + files tables and try a test insert/delete.
// Remove after debugging.
export async function GET() {
  try {
    const subjectCols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'subjects'
      ORDER BY ordinal_position
    `;
    const fileCols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'files'
      ORDER BY ordinal_position
    `;

    // Try a real insert + delete cycle
    let insertResult: unknown = null;
    let insertError: string | null = null;
    try {
      const r = await sql`
        INSERT INTO subjects (user_id, name, test_label, test_date)
        VALUES ('diag-test-user', 'diag-test-subject', null, null)
        RETURNING *
      `;
      insertResult = r.rows[0];
      // clean up
      await sql`DELETE FROM subjects WHERE user_id = 'diag-test-user'`;
    } catch (err) {
      insertError = err instanceof Error ? err.message : "unknown";
    }

    return NextResponse.json({
      ok: true,
      subjectsColumns: subjectCols.rows,
      filesColumns: fileCols.rows,
      testInsertResult: insertResult,
      testInsertError: insertError,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
