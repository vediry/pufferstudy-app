"use client";

import * as React from "react";

export type AssignmentStatus = "todo" | "in_progress" | "done";

export type Assignment = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  status: AssignmentStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbAssignment = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAssignments(): Promise<Assignment[]> {
  const res = await fetch("/api/assignments", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchAssignments ${res.status}`);
  const data = (await res.json()) as { assignments: DbAssignment[] };
  return data.assignments.map(mapAssignment);
}

export async function createAssignment(input: {
  title: string;
  description?: string;
  dueDate?: string | null;
}): Promise<Assignment> {
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`createAssignment ${res.status}`);
  const data = (await res.json()) as { assignment: DbAssignment };
  return mapAssignment(data.assignment);
}

export async function updateAssignment(
  id: string,
  patch: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    status?: AssignmentStatus;
  },
): Promise<Assignment> {
  const res = await fetch(`/api/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`updateAssignment ${res.status}`);
  const data = (await res.json()) as { assignment: DbAssignment };
  return mapAssignment(data.assignment);
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteAssignment ${res.status}`);
}

export function useAssignments() {
  const [assignments, setAssignments] = React.useState<Assignment[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await fetchAssignments();
      setAssignments(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load assignments.");
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { assignments, error, refresh, setAssignments };
}
