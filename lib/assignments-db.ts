import "server-only";
import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";

export type AssignmentStatus = "todo" | "in_progress" | "done";

export type DbAssignment = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listAssignments(userId: string): Promise<DbAssignment[]> {
  const { rows } = await sql<DbAssignment>`
    SELECT * FROM assignments
    WHERE user_id = ${userId}
    ORDER BY
      CASE WHEN status = 'done' THEN 1 ELSE 0 END,
      due_date NULLS LAST,
      created_at DESC
  `;
  return rows;
}

export async function getAssignment(
  userId: string,
  id: string,
): Promise<DbAssignment | null> {
  const { rows } = await sql<DbAssignment>`
    SELECT * FROM assignments WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function createAssignment(
  userId: string,
  input: { title: string; description?: string; dueDate?: string | null },
): Promise<DbAssignment> {
  const id = randomUUID();
  const { rows } = await sql<DbAssignment>`
    INSERT INTO assignments (id, user_id, title, description, due_date)
    VALUES (
      ${id},
      ${userId},
      ${input.title},
      ${input.description ?? ""},
      ${input.dueDate ?? null}::date
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateAssignment(
  userId: string,
  id: string,
  patch: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    status?: AssignmentStatus;
  },
): Promise<DbAssignment | null> {
  const noFields =
    patch.title === undefined &&
    patch.description === undefined &&
    patch.dueDate === undefined &&
    patch.status === undefined;
  if (noFields) return getAssignment(userId, id);

  // completed_at gets set when status transitions to "done" and cleared otherwise.
  const setCompletedAt = patch.status === "done";
  const clearCompletedAt =
    patch.status !== undefined && patch.status !== "done";

  const { rows } = await sql<DbAssignment>`
    UPDATE assignments
    SET
      title       = COALESCE(${patch.title ?? null}, title),
      description = COALESCE(${patch.description ?? null}, description),
      due_date    = CASE WHEN ${patch.dueDate === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.dueDate ?? null}::date ELSE due_date END,
      status      = COALESCE(${patch.status ?? null}, status),
      completed_at = CASE
        WHEN ${setCompletedAt ? "set" : clearCompletedAt ? "clear" : "skip"}::text = 'set' THEN now()
        WHEN ${setCompletedAt ? "set" : clearCompletedAt ? "clear" : "skip"}::text = 'clear' THEN NULL
        ELSE completed_at
      END,
      updated_at  = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function deleteAssignment(
  userId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM assignments WHERE id = ${id} AND user_id = ${userId}
  `;
  return (rowCount ?? 0) > 0;
}
