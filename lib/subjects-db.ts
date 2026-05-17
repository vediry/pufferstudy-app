import "server-only";
import { sql } from "@vercel/postgres";

export type DbSubject = {
  id: string;
  user_id: string;
  name: string;
  test_label: string | null;
  created_at: string;
  updated_at: string;
};

export type DbFile = {
  id: string;
  subject_id: string;
  user_id: string;
  blob_url: string;
  blob_path: string;
  mime_type: string;
  caption: string;
  position: number;
  added_at: string;
};

export type SubjectWithFiles = DbSubject & { files: DbFile[] };

export async function listSubjects(userId: string): Promise<DbSubject[]> {
  const { rows } = await sql<DbSubject>`
    SELECT * FROM subjects WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows;
}

export async function getSubjectWithFiles(
  userId: string,
  subjectId: string,
): Promise<SubjectWithFiles | null> {
  const { rows: subjectRows } = await sql<DbSubject>`
    SELECT * FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}
  `;
  const subject = subjectRows[0];
  if (!subject) return null;

  const { rows: fileRows } = await sql<DbFile>`
    SELECT * FROM files WHERE subject_id = ${subjectId} AND user_id = ${userId}
    ORDER BY position ASC, added_at ASC
  `;
  return { ...subject, files: fileRows };
}

export async function createSubject(
  userId: string,
  input: { name: string; testLabel?: string | null },
): Promise<DbSubject> {
  const { rows } = await sql<DbSubject>`
    INSERT INTO subjects (user_id, name, test_label)
    VALUES (${userId}, ${input.name}, ${input.testLabel ?? null})
    RETURNING *
  `;
  return rows[0];
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  patch: { name?: string; testLabel?: string | null },
): Promise<DbSubject | null> {
  if (patch.name === undefined && patch.testLabel === undefined) {
    const { rows } = await sql<DbSubject>`
      SELECT * FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}
    `;
    return rows[0] ?? null;
  }
  const { rows } = await sql<DbSubject>`
    UPDATE subjects
    SET
      name = COALESCE(${patch.name ?? null}, name),
      test_label = COALESCE(${patch.testLabel ?? null}, test_label),
      updated_at = now()
    WHERE id = ${subjectId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function deleteSubject(
  userId: string,
  subjectId: string,
): Promise<DbFile[]> {
  const { rows: files } = await sql<DbFile>`
    DELETE FROM files WHERE subject_id = ${subjectId} AND user_id = ${userId}
    RETURNING *
  `;
  await sql`DELETE FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}`;
  return files;
}

export async function ownsSubject(
  userId: string,
  subjectId: string,
): Promise<boolean> {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS(SELECT 1 FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}) AS exists
  `;
  return rows[0]?.exists ?? false;
}

export async function createFile(
  userId: string,
  subjectId: string,
  input: {
    blobUrl: string;
    blobPath: string;
    mimeType: string;
    caption?: string;
  },
): Promise<DbFile> {
  const { rows: posRows } = await sql<{ next: number }>`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM files WHERE subject_id = ${subjectId}
  `;
  const nextPosition = posRows[0]?.next ?? 0;

  const { rows } = await sql<DbFile>`
    INSERT INTO files (subject_id, user_id, blob_url, blob_path, mime_type, caption, position)
    VALUES (${subjectId}, ${userId}, ${input.blobUrl}, ${input.blobPath}, ${input.mimeType}, ${input.caption ?? ""}, ${nextPosition})
    RETURNING *
  `;
  await sql`UPDATE subjects SET updated_at = now() WHERE id = ${subjectId} AND user_id = ${userId}`;
  return rows[0];
}

export async function updateFileCaption(
  userId: string,
  fileId: string,
  caption: string,
): Promise<DbFile | null> {
  const { rows } = await sql<DbFile>`
    UPDATE files SET caption = ${caption}
    WHERE id = ${fileId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function deleteFile(
  userId: string,
  fileId: string,
): Promise<DbFile | null> {
  const { rows } = await sql<DbFile>`
    DELETE FROM files WHERE id = ${fileId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getFilesByIds(
  userId: string,
  fileIds: string[],
): Promise<DbFile[]> {
  if (fileIds.length === 0) return [];
  const found: DbFile[] = [];
  for (const id of fileIds) {
    const { rows } = await sql<DbFile>`
      SELECT * FROM files WHERE id = ${id} AND user_id = ${userId}
    `;
    if (rows[0]) found.push(rows[0]);
  }
  return found;
}
