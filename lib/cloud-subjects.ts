"use client";

import * as React from "react";
import type { ChatMessage } from "@/types";

export type Subject = {
  id: string;
  name: string;
  testLabel: string | null;
  testDate: string | null;
  cheatsheetMarkdown: string | null;
  cheatsheetGeneratedAt: string | null;
  chatMessages: ChatMessage[];
  archived: boolean;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SubjectFile = {
  id: string;
  subjectId: string;
  blobUrl: string;
  mimeType: string;
  caption: string;
  position: number;
  addedAt: string;
};

export type SubjectWithFiles = Subject & { files: SubjectFile[] };

type DbSubject = {
  id: string;
  name: string;
  test_label: string | null;
  test_date: string | null;
  cheatsheet_markdown: string | null;
  cheatsheet_generated_at: string | null;
  chat_messages: ChatMessage[];
  archived: boolean;
  file_count?: number;
  created_at: string;
  updated_at: string;
};

type DbFile = {
  id: string;
  subject_id: string;
  blob_url: string;
  mime_type: string;
  caption: string;
  position: number;
  added_at: string;
};

function mapSubject(row: DbSubject): Subject {
  return {
    id: row.id,
    name: row.name,
    testLabel: row.test_label,
    testDate: row.test_date,
    cheatsheetMarkdown: row.cheatsheet_markdown,
    cheatsheetGeneratedAt: row.cheatsheet_generated_at,
    chatMessages: row.chat_messages ?? [],
    archived: row.archived ?? false,
    fileCount: row.file_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFile(row: DbFile): SubjectFile {
  return {
    id: row.id,
    subjectId: row.subject_id,
    blobUrl: row.blob_url,
    mimeType: row.mime_type,
    caption: row.caption,
    position: row.position,
    addedAt: row.added_at,
  };
}

export async function fetchSubjects(): Promise<Subject[]> {
  const res = await fetch("/api/subjects", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchSubjects ${res.status}`);
  const data = (await res.json()) as { subjects: DbSubject[] };
  return data.subjects.map(mapSubject);
}

export async function fetchSubject(id: string): Promise<SubjectWithFiles | null> {
  const res = await fetch(`/api/subjects/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchSubject ${res.status}`);
  const data = (await res.json()) as { subject: DbSubject & { files: DbFile[] } };
  return {
    ...mapSubject(data.subject),
    files: data.subject.files.map(mapFile),
  };
}

export async function createSubject(input: {
  name: string;
  testLabel?: string | null;
  testDate?: string | null;
}): Promise<Subject> {
  const res = await fetch("/api/subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`createSubject ${res.status}`);
  const data = (await res.json()) as { subject: DbSubject };
  return mapSubject(data.subject);
}

export async function updateSubject(
  id: string,
  patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
    archived?: boolean;
  },
): Promise<Subject> {
  const res = await fetch(`/api/subjects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateSubject ${res.status}`);
  const data = (await res.json()) as { subject: DbSubject };
  return mapSubject(data.subject);
}

export async function archiveSubject(id: string, archived: boolean): Promise<Subject> {
  return updateSubject(id, { archived });
}

export async function deleteSubject(id: string): Promise<void> {
  const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteSubject ${res.status}`);
}

export async function uploadFile(
  subjectId: string,
  file: File | Blob,
  caption: string = "",
): Promise<SubjectFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("caption", caption);
  const res = await fetch(`/api/subjects/${subjectId}/files`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    const detail = data.message ?? data.error ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  const data = (await res.json()) as { file: DbFile };
  return mapFile(data.file);
}

export async function updateFileCaption(
  subjectId: string,
  fileId: string,
  caption: string,
): Promise<SubjectFile> {
  const res = await fetch(`/api/subjects/${subjectId}/files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caption }),
  });
  if (!res.ok) throw new Error(`updateFileCaption ${res.status}`);
  const data = (await res.json()) as { file: DbFile };
  return mapFile(data.file);
}

export async function deleteFile(
  subjectId: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(`/api/subjects/${subjectId}/files/${fileId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`deleteFile ${res.status}`);
}

export async function transcribeFile(
  fileId: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, apiKey }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
    };
    throw new Error(data.message ?? data.error ?? `transcribe ${res.status}`);
  }
  const data = (await res.json()) as { transcription: string };
  return data.transcription;
}

export function useSubjects() {
  const [subjects, setSubjects] = React.useState<Subject[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await fetchSubjects();
      setSubjects(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load subjects.");
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { subjects, error, refresh };
}

export function useSubject(id: string | undefined) {
  const [subject, setSubject] = React.useState<SubjectWithFiles | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchSubject(id);
      setSubject(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this subject.");
      setSubject(null);
    }
  }, [id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { subject, error, refresh, setSubject };
}
