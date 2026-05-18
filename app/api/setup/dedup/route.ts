import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubjectWithCount = {
  id: string;
  name: string;
  created_at: string;
  file_count: number;
};

type FileRow = {
  blob_url: string;
};

// One-shot dedup: for each group of subjects with identical (lowercase, trimmed) names,
// keep the one with the most files (tiebreaker: oldest), delete the rest along with
// their blob URLs.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { rows: subjects } = await sql<SubjectWithCount>`
      SELECT
        s.id,
        s.name,
        s.created_at::text,
        COUNT(f.id)::int AS file_count
      FROM subjects s
      LEFT JOIN files f ON f.subject_id = s.id
      WHERE s.user_id = ${userId}
      GROUP BY s.id, s.name, s.created_at
      ORDER BY s.created_at ASC
    `;

    // Group by normalized name
    const groups = new Map<string, SubjectWithCount[]>();
    for (const s of subjects) {
      const key = s.name.trim().toLowerCase();
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }

    const removedSubjectIds: string[] = [];
    const removedBlobUrls: string[] = [];
    const kept: Array<{ name: string; id: string; fileCount: number }> = [];

    for (const [key, group] of groups) {
      if (group.length <= 1) continue;

      // Pick winner: most files, then oldest
      group.sort((a, b) => {
        if (b.file_count !== a.file_count) return b.file_count - a.file_count;
        return a.created_at.localeCompare(b.created_at);
      });
      const winner = group[0];
      const losers = group.slice(1);

      kept.push({ name: winner.name, id: winner.id, fileCount: winner.file_count });

      for (const loser of losers) {
        const { rows: files } = await sql<FileRow>`
          SELECT blob_url FROM files WHERE subject_id = ${loser.id} AND user_id = ${userId}
        `;
        for (const f of files) {
          removedBlobUrls.push(f.blob_url);
        }
        await sql`DELETE FROM subjects WHERE id = ${loser.id} AND user_id = ${userId}`;
        removedSubjectIds.push(loser.id);
      }
    }

    // Best-effort blob cleanup (failures don't block)
    let blobsDeleted = 0;
    let blobsFailed = 0;
    for (const url of removedBlobUrls) {
      try {
        await del(url);
        blobsDeleted++;
      } catch {
        blobsFailed++;
      }
    }

    return NextResponse.json({
      ok: true,
      groupsScanned: groups.size,
      subjectsRemoved: removedSubjectIds.length,
      blobsDeleted,
      blobsFailed,
      kept,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "dedup_failed",
        message: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
