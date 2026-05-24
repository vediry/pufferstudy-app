import "server-only";
import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";

export type DbNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export async function listNotes(userId: string): Promise<DbNote[]> {
  const { rows } = await sql<DbNote>`
    SELECT * FROM notes
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;
  return rows;
}

export async function getNote(userId: string, id: string): Promise<DbNote | null> {
  const { rows } = await sql<DbNote>`
    SELECT * FROM notes WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function createNote(
  userId: string,
  input: { title?: string; content?: string },
): Promise<DbNote> {
  const id = randomUUID();
  const { rows } = await sql<DbNote>`
    INSERT INTO notes (id, user_id, title, content)
    VALUES (${id}, ${userId}, ${input.title ?? ""}, ${input.content ?? ""})
    RETURNING *
  `;
  return rows[0];
}

export async function updateNote(
  userId: string,
  id: string,
  patch: { title?: string; content?: string },
): Promise<DbNote | null> {
  if (patch.title === undefined && patch.content === undefined) {
    return getNote(userId, id);
  }
  const { rows } = await sql<DbNote>`
    UPDATE notes
    SET
      title = COALESCE(${patch.title ?? null}, title),
      content = COALESCE(${patch.content ?? null}, content),
      updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function deleteNote(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await sql`
    DELETE FROM notes WHERE id = ${id} AND user_id = ${userId}
  `;
  return (rowCount ?? 0) > 0;
}
