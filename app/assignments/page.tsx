"use client";

import * as React from "react";
import { Plus, Trash2, Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { daysUntil } from "@/lib/desk";
import {
  useAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  type Assignment,
  type AssignmentStatus,
} from "@/lib/cloud-assignments";

type Filter = "active" | "all" | "done";

export default function AssignmentsPage() {
  const { assignments, error, refresh, setAssignments } = useAssignments();
  const [filter, setFilter] = React.useState<Filter>("active");
  const [newTitle, setNewTitle] = React.useState("");
  const [newDue, setNewDue] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const list = assignments ?? [];
  const todoCount = list.filter((a) => a.status !== "done").length;
  const doneCount = list.filter((a) => a.status === "done").length;

  const filtered = React.useMemo(() => {
    if (filter === "all") return list;
    if (filter === "done") return list.filter((a) => a.status === "done");
    return list.filter((a) => a.status !== "done");
  }, [list, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const assignment = await createAssignment({
        title,
        dueDate: newDue || null,
      });
      setAssignments((prev) => (prev ? [assignment, ...prev] : [assignment]));
      setNewTitle("");
      setNewDue("");
    } catch (err) {
      console.error("createAssignment failed:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatus(a: Assignment, next: AssignmentStatus) {
    const prev = assignments ?? [];
    setAssignments(prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    try {
      const updated = await updateAssignment(a.id, { status: next });
      setAssignments((curr) =>
        curr ? curr.map((x) => (x.id === updated.id ? updated : x)) : curr,
      );
    } catch {
      setAssignments(prev);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this assignment?")) return;
    const prev = assignments ?? [];
    setAssignments(prev.filter((a) => a.id !== id));
    try {
      await deleteAssignment(id);
    } catch {
      setAssignments(prev);
      await refresh();
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Assignments
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Track what&apos;s due. Soonest deadlines also show on your Study Desk timeline.
        </p>
      </header>

      {/* Inline create form */}
      <form
        onSubmit={handleCreate}
        className="glow-card mb-6 flex flex-col gap-3 border border-default bg-surface p-4 sm:flex-row sm:items-center"
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New assignment — e.g. 'Essay draft on photosynthesis'"
          className="flex-1 rounded-[10px] border border-default bg-surface-2 px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          maxLength={200}
        />
        <input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          className="rounded-[10px] border border-default bg-surface-2 px-3 py-2 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
        <Button type="submit" disabled={creating || !newTitle.trim()}>
          <Plus />
          Add
        </Button>
      </form>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill
          active={filter === "active"}
          onClick={() => setFilter("active")}
          label={`Active (${todoCount})`}
        />
        <FilterPill
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All (${list.length})`}
        />
        <FilterPill
          active={filter === "done"}
          onClick={() => setFilter("done")}
          label={`Done (${doneCount})`}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-[12px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* List */}
      {assignments === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-[18px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glow-card flex flex-col items-center gap-2 border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
          <p className="text-sm text-ink-muted">
            {filter === "done"
              ? "No completed assignments yet."
              : list.length === 0
                ? "No assignments yet. Add your first above."
                : "Nothing active. Switch to 'All' to see everything."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((a, i) => (
            <li key={a.id}>
              <Reveal index={i}>
                <AssignmentRow
                  assignment={a}
                  onStatus={(next) => handleStatus(a, next)}
                  onDelete={() => handleDelete(a.id)}
                />
              </Reveal>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glow-on-hover inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active
          ? "border-[color:var(--accent)] bg-surface text-[color:var(--accent-deep)]"
          : "border-default bg-surface-2 text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

const STATUS_ORDER: AssignmentStatus[] = ["todo", "in_progress", "done"];
const STATUS_LABEL: Record<AssignmentStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};
const STATUS_ICON: Record<AssignmentStatus, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  todo: Circle,
  in_progress: CircleDot,
  done: CheckCircle2,
};

function AssignmentRow({
  assignment,
  onStatus,
  onDelete,
}: {
  assignment: Assignment;
  onStatus: (next: AssignmentStatus) => void;
  onDelete: () => void;
}) {
  const Icon = STATUS_ICON[assignment.status];
  const days = daysUntil(assignment.dueDate);
  const dueBadge = (() => {
    if (days === null) return null;
    if (days < 0) return { tone: "past" as const, label: `${Math.abs(days)}d overdue` };
    if (days === 0) return { tone: "danger" as const, label: "Due today" };
    if (days === 1) return { tone: "danger" as const, label: "Due tomorrow" };
    if (days <= 3) return { tone: "danger" as const, label: `In ${days} days` };
    if (days <= 7) return { tone: "warning" as const, label: `In ${days} days` };
    return { tone: "neutral" as const, label: `In ${days} days` };
  })();

  const isDone = assignment.status === "done";

  function cycleStatus() {
    const idx = STATUS_ORDER.indexOf(assignment.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    onStatus(next);
  }

  return (
    <div className="glow-card group flex items-center gap-3 border border-default bg-surface px-4 py-3">
      <button
        type="button"
        onClick={cycleStatus}
        title={`Status: ${STATUS_LABEL[assignment.status]} (click to cycle)`}
        aria-label={`Cycle status from ${STATUS_LABEL[assignment.status]}`}
        className={`glow-on-hover inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-default transition-colors ${
          isDone
            ? "bg-surface-2 text-[color:var(--success,var(--accent))]"
            : assignment.status === "in_progress"
              ? "bg-surface-2 text-[color:var(--accent)]"
              : "bg-surface-2 text-ink-muted hover:text-ink"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] font-semibold leading-tight ${
            isDone ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {assignment.title}
        </p>
        {assignment.description ? (
          <p className="mt-1 line-clamp-1 text-[12px] text-ink-muted">{assignment.description}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {dueBadge ? <Badge tone={dueBadge.tone}>{dueBadge.label}</Badge> : null}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete assignment"
          title="Delete"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-[color:var(--danger)] group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
