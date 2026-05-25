import "server-only";
import { sql } from "@vercel/postgres";
import type { ChatMessage } from "@/types";

export type DbSubject = {
  id: string;
  user_id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  study_guide_markdown: string | null;
  study_guide_generated_at: string | null;
  chat_messages: ChatMessage[];
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type DbSubjectWithFileCount = DbSubject & { file_count: number };

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

export async function listSubjects(userId: string): Promise<DbSubjectWithFileCount[]> {
  const { rows } = await sql<DbSubjectWithFileCount>`
    SELECT
      s.id, s.user_id, s.name, s.test_label, s.test_date,
      s.cheatsheet_markdown, s.cheatsheet_generated_at,
      s.study_guide_markdown, s.study_guide_generated_at,
      s.chat_messages, s.archived, s.created_at, s.updated_at,
      COALESCE(COUNT(f.id), 0)::int AS file_count
    FROM subjects s
    LEFT JOIN files f ON f.subject_id = s.id
    WHERE s.user_id = ${userId}
    GROUP BY s.id
    ORDER BY s.updated_at DESC
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
  input: {
    name: string;
    testLabel?: string | null;
    testDate?: string | null;
  },
): Promise<DbSubject> {
  const { rows } = await sql<DbSubject>`
    INSERT INTO subjects (user_id, name, test_label, test_date)
    VALUES (${userId}, ${input.name}, ${input.testLabel ?? null}, ${input.testDate ?? null})
    RETURNING *
  `;
  return rows[0];
}

export async function updateSubject(
  userId: string,
  subjectId: string,
  patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    studyGuideMarkdown?: string | null;
    chatMessages?: ChatMessage[];
    archived?: boolean;
  },
): Promise<DbSubject | null> {
  const noFields =
    patch.name === undefined &&
    patch.testLabel === undefined &&
    patch.testDate === undefined &&
    patch.cheatsheetMarkdown === undefined &&
    patch.studyGuideMarkdown === undefined &&
    patch.chatMessages === undefined &&
    patch.archived === undefined;

  if (noFields) {
    const { rows } = await sql<DbSubject>`
      SELECT * FROM subjects WHERE id = ${subjectId} AND user_id = ${userId}
    `;
    return rows[0] ?? null;
  }

  const cheatsheetTimestamp = patch.cheatsheetMarkdown !== undefined ? new Date().toISOString() : null;
  const studyGuideTimestamp = patch.studyGuideMarkdown !== undefined ? new Date().toISOString() : null;
  const chatJson = patch.chatMessages !== undefined ? JSON.stringify(patch.chatMessages) : null;

  const { rows } = await sql<DbSubject>`
    UPDATE subjects
    SET
      name = COALESCE(${patch.name ?? null}, name),
      test_label = CASE WHEN ${patch.testLabel === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testLabel ?? null} ELSE test_label END,
      test_date = CASE WHEN ${patch.testDate === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.testDate ?? null}::date ELSE test_date END,
      cheatsheet_markdown = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.cheatsheetMarkdown ?? null} ELSE cheatsheet_markdown END,
      cheatsheet_generated_at = CASE WHEN ${patch.cheatsheetMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${cheatsheetTimestamp}::timestamptz ELSE cheatsheet_generated_at END,
      study_guide_markdown = CASE WHEN ${patch.studyGuideMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.studyGuideMarkdown ?? null} ELSE study_guide_markdown END,
      study_guide_generated_at = CASE WHEN ${patch.studyGuideMarkdown === undefined ? "no" : "yes"}::text = 'yes' THEN ${studyGuideTimestamp}::timestamptz ELSE study_guide_generated_at END,
      chat_messages = CASE WHEN ${patch.chatMessages === undefined ? "no" : "yes"}::text = 'yes' THEN ${chatJson}::jsonb ELSE chat_messages END,
      archived = CASE WHEN ${patch.archived === undefined ? "no" : "yes"}::text = 'yes' THEN ${patch.archived ?? false}::boolean ELSE archived END,
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
