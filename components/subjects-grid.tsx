"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { SubjectCard } from "@/components/subject-card";
import { sortSubjects, filterSubjects, type SortMode } from "@/lib/desk";
import { archiveSubject } from "@/lib/cloud-subjects";
import type { Subject } from "@/lib/cloud-subjects";

const SORT_KEY = "pufferstudy.deskSort";

type Props = {
  subjects: Subject[];
  onSubjectsChange: (updater: (prev: Subject[]) => Subject[]) => void;
};

function loadSort(): SortMode {
  if (typeof window === "undefined") return "urgency";
  const raw = window.localStorage.getItem(SORT_KEY);
  if (raw === "urgency" || raw === "recent" || raw === "alpha") return raw;
  return "urgency";
}

export function SubjectsGrid({ subjects, onSubjectsChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>(loadSort());
  const [showArchived, setShowArchived] = React.useState(false);

  const persistedSort = React.useCallback((m: SortMode) => {
    setSortMode(m);
    try { window.localStorage.setItem(SORT_KEY, m); } catch {}
  }, []);

  const active = subjects.filter((s) => !s.archived);
  const archived = subjects.filter((s) => s.archived);

  const visible = React.useMemo(() => {
    return sortSubjects(filterSubjects(active, query), sortMode);
  }, [active, query, sortMode]);

  const handleChat = (s: Subject) => router.push(`/subjects/${s.id}/cheatsheet`);

  const handleArchive = async (s: Subject) => {
    onSubjectsChange((prev) =>
      prev.map((p) => (p.id === s.id ? { ...p, archived: !p.archived } : p))
    );
    try {
      await archiveSubject(s.id, !s.archived);
    } catch (err) {
      onSubjectsChange((prev) =>
        prev.map((p) => (p.id === s.id ? { ...p, archived: s.archived } : p))
      );
      console.error("archive failed:", err);
    }
  };

  // Regenerate-from-desk needs Gemini key + streaming PATCH that v2.3 doesn't wire from
  // the desk. Navigating to the cheatsheet page (where Regenerate already exists) keeps
  // scope tight without losing the affordance.
  const handleRegenerate = (s: Subject) => router.push(`/subjects/${s.id}/cheatsheet`);

  return (
    <div className="border border-default bg-surface p-5">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        All subjects ({active.length})
      </p>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects…"
            className="w-full border border-default bg-surface-2 px-3 py-2 pl-9 text-sm font-medium text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => persistedSort(e.target.value as SortMode)}
          className="border border-strong bg-surface px-3 py-2 text-sm font-semibold text-ink"
        >
          <option value="urgency">By urgency</option>
          <option value="recent">Recently studied</option>
          <option value="alpha">Alphabetical</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          {query ? "No subjects match that search." : "Add your first subject to get started."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              onChat={handleChat}
              onRegenerate={handleRegenerate}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="mt-5 w-full border-t border-dashed border-default pt-3 text-center text-sm font-semibold text-ink-faint hover:text-ink-muted"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {archived.map((s) => (
                <SubjectCard
                  key={s.id}
                  subject={s}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
