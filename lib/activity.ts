import "server-only";
import { sql } from "@vercel/postgres";

export type ActivityEventType =
  | "cheatsheet_generated"
  | "cheatsheet_refined"
  | "chat_question"
  | "files_uploaded"
  | "subject_created"
  | "assignment_created"
  | "assignment_completed"
  | "flashcards_generated"
  | "study_guide_generated"
  | "practice_generated"
  | "practice_completed";

export type ActivityEvent = {
  id: number;
  subjectId: string | null;
  subjectName: string | null;
  type: ActivityEventType;
  data: Record<string, unknown>;
  createdAt: string;
};

type LogInput = {
  userId: string;
  subjectId: string | null;
  type: ActivityEventType;
  data: Record<string, unknown>;
};

/**
 * Fire-and-forget. Records a row in activity_log. A DB failure logs to
 * console and returns — never throws into the calling endpoint.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await sql`
      INSERT INTO activity_log (user_id, subject_id, event_type, event_data)
      VALUES (${input.userId}, ${input.subjectId}, ${input.type}, ${JSON.stringify(input.data)}::jsonb)
    `;
  } catch (err) {
    console.error("logActivity failed:", err);
  }
}

export async function listActivity(userId: string, limit: number): Promise<ActivityEvent[]> {
  const safeLimit = Math.max(1, Math.min(100, limit | 0));
  const { rows } = await sql<{
    id: number;
    subject_id: string | null;
    event_type: ActivityEventType;
    event_data: Record<string, unknown>;
    created_at: string;
    subject_name: string | null;
  }>`
    SELECT
      a.id,
      a.subject_id,
      a.event_type,
      a.event_data,
      a.created_at,
      s.name AS subject_name
    FROM activity_log a
    LEFT JOIN subjects s ON s.id::text = a.subject_id
    WHERE a.user_id = ${userId}
    ORDER BY a.created_at DESC
    LIMIT ${safeLimit}
  `;
  return rows.map((r) => ({
    id: r.id,
    subjectId: r.subject_id,
    subjectName: r.subject_name,
    type: r.event_type,
    data: r.event_data ?? {},
    createdAt: r.created_at,
  }));
}
