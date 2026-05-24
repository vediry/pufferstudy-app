"use client";

import * as React from "react";
import { NotebookPen, Plus, Trash2, FileText, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/desk";
import {
  useNotes,
  createNote,
  updateNote,
  deleteNote,
  type Note,
} from "@/lib/cloud-notes";

const AUTOSAVE_MS = 800;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function NotepadPage() {
  const { notes, error, refresh, setNotes } = useNotes();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftContent, setDraftContent] = React.useState("");
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const saveTimer = React.useRef<number | null>(null);
  const lastSyncedRef = React.useRef<{ title: string; content: string } | null>(null);

  // When notes load, pick the most recent as active (or null if none).
  React.useEffect(() => {
    if (notes && activeId === null && notes.length > 0) {
      setActiveId(notes[0].id);
    }
  }, [notes, activeId]);

  // When the active note changes, hydrate the draft from it.
  React.useEffect(() => {
    if (!notes) return;
    const note = notes.find((n) => n.id === activeId) ?? null;
    if (note) {
      setDraftTitle(note.title);
      setDraftContent(note.content);
      lastSyncedRef.current = { title: note.title, content: note.content };
      setSaveState("idle");
    }
  }, [activeId, notes]);

  // Debounced autosave when draft diverges from last-synced.
  React.useEffect(() => {
    if (!activeId || !lastSyncedRef.current) return;
    const dirty =
      draftTitle !== lastSyncedRef.current.title ||
      draftContent !== lastSyncedRef.current.content;
    if (!dirty) return;

    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const updated = await updateNote(activeId, {
          title: draftTitle,
          content: draftContent,
        });
        lastSyncedRef.current = { title: updated.title, content: updated.content };
        setSaveState("saved");
        // Update the list so updatedAt + title preview refresh.
        setNotes((prev) =>
          prev
            ? prev
                .map((n) => (n.id === updated.id ? updated : n))
                .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
            : prev,
        );
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_MS);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draftTitle, draftContent, activeId, setNotes]);

  const handleNew = React.useCallback(async () => {
    try {
      const note = await createNote({ title: "Untitled note", content: "" });
      setNotes((prev) => (prev ? [note, ...prev] : [note]));
      setActiveId(note.id);
    } catch (err) {
      console.error("createNote failed:", err);
    }
  }, [setNotes]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this note?")) return;
      const prev = notes ?? [];
      setNotes(prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
      try {
        await deleteNote(id);
      } catch {
        // Roll back
        setNotes(prev);
        await refresh();
      }
    },
    [notes, activeId, setNotes, refresh],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-2">
        <h1
          className="text-[2rem] leading-tight tracking-tight text-ink sm:text-[2.4rem]"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          Notepad
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          Freeform notes that don&apos;t belong to a subject yet. Autosaves as you type.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-[12px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* List rail */}
        <aside className="glow-card flex w-full flex-col gap-3 border border-default bg-surface p-4 lg:w-[300px] lg:shrink-0 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <header className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              All notes {notes ? `(${notes.length})` : ""}
            </p>
            <button
              type="button"
              onClick={handleNew}
              className="glow-on-hover inline-flex items-center gap-1 rounded-[10px] border border-default bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-muted hover:text-ink"
              aria-label="New note"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              New
            </button>
          </header>

          {notes === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-[10px] bg-surface-2/60" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <button
              type="button"
              onClick={handleNew}
              className="glow-on-hover flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-default bg-surface-2/40 px-4 py-6 text-center text-sm text-ink-muted hover:text-ink"
            >
              <Plus className="h-5 w-5" strokeWidth={1.75} />
              Start your first note
            </button>
          ) : (
            <ul className="flex flex-col gap-1">
              {notes.map((note) => (
                <li key={note.id}>
                  <NoteRow
                    note={note}
                    active={note.id === activeId}
                    onSelect={() => setActiveId(note.id)}
                    onDelete={() => handleDelete(note.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <section className="glow-card flex min-w-0 flex-1 flex-col border border-default bg-surface">
          {activeId && notes && notes.some((n) => n.id === activeId) ? (
            <Editor
              title={draftTitle}
              content={draftContent}
              onTitle={setDraftTitle}
              onContent={setDraftContent}
              saveState={saveState}
            />
          ) : (
            <EmptyEditor onNew={handleNew} hasAny={!!notes && notes.length > 0} />
          )}
        </section>
      </div>
    </div>
  );
}

function NoteRow({
  note,
  active,
  onSelect,
  onDelete,
}: {
  note: Note;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const title = note.title.trim() || "Untitled note";
  const preview = note.content.trim().split("\n")[0]?.slice(0, 60) || "Empty";
  return (
    <div
      className={`group flex items-start gap-2 rounded-[10px] border border-transparent px-2 py-2 transition-colors ${
        active ? "bg-surface-2 border-default" : "hover:bg-surface-2/60"
      }`}
      style={
        active
          ? {
              boxShadow:
                "0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 12px -2px color-mix(in srgb, var(--accent) 30%, transparent)",
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="text-sm font-semibold leading-tight text-ink line-clamp-1">{title}</span>
        <span className="text-[12px] leading-tight text-ink-faint line-clamp-1">{preview}</span>
        <span className="tabular text-[11px] text-ink-faint">
          {formatRelativeTime(note.updatedAt)}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete note"
        title="Delete note"
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition-opacity hover:bg-surface-3 hover:text-[color:var(--danger)] group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Editor({
  title,
  content,
  onTitle,
  onContent,
  saveState,
}: {
  title: string;
  content: string;
  onTitle: (v: string) => void;
  onContent: (v: string) => void;
  saveState: SaveState;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex items-center justify-between border-b border-default px-4 py-2">
        <SaveIndicator state={saveState} />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Title"
        className="border-0 bg-transparent px-6 pt-5 text-[1.6rem] leading-tight text-ink placeholder:text-ink-faint focus:outline-none"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      />
      <textarea
        value={content}
        onChange={(e) => onContent(e.target.value)}
        placeholder="Start writing…"
        className="min-h-[400px] flex-1 resize-none border-0 bg-transparent px-6 py-4 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
        <Check className="h-3 w-3" strokeWidth={2} />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="text-[11px] font-semibold text-[color:var(--danger)]">
        Couldn&apos;t save
      </span>
    );
  }
  return <span className="text-[11px] font-semibold text-ink-faint">Ready</span>;
}

function EmptyEditor({ onNew, hasAny }: { onNew: () => void; hasAny: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
        style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
      >
        {hasAny ? (
          <FileText className="h-6 w-6" strokeWidth={1.5} />
        ) : (
          <NotebookPen className="h-6 w-6" strokeWidth={1.5} />
        )}
      </div>
      <h2
        className="text-[1.3rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        {hasAny ? "Pick a note" : "Your notepad is empty"}
      </h2>
      <p className="max-w-md text-sm text-ink-muted">
        {hasAny
          ? "Select a note from the list, or start a new one."
          : "Quick thoughts, scratch notes, anything that doesn't belong to a subject yet."}
      </p>
      <Button onClick={onNew} size="lg">
        <Plus />
        New note
      </Button>
    </div>
  );
}
