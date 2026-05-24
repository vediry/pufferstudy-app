"use client";

import * as React from "react";

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type DbNote = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

function mapNote(row: DbNote): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchNotes(): Promise<Note[]> {
  const res = await fetch("/api/notes", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchNotes ${res.status}`);
  const data = (await res.json()) as { notes: DbNote[] };
  return data.notes.map(mapNote);
}

export async function createNote(input: {
  title?: string;
  content?: string;
}): Promise<Note> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  if (!res.ok) throw new Error(`createNote ${res.status}`);
  const data = (await res.json()) as { note: DbNote };
  return mapNote(data.note);
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string },
): Promise<Note> {
  const res = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateNote ${res.status}`);
  const data = (await res.json()) as { note: DbNote };
  return mapNote(data.note);
}

export async function deleteNote(id: string): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteNote ${res.status}`);
}

export function useNotes() {
  const [notes, setNotes] = React.useState<Note[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await fetchNotes();
      setNotes(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load notes.");
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { notes, error, refresh, setNotes };
}
