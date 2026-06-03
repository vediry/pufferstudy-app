"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Layers,
  ArrowRight,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  BookOpen,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Puffer } from "@/components/puffer";
import {
  useDecks,
  deleteDeck,
  generateDeck,
  type FlashcardDeck,
} from "@/lib/cloud-flashcards";
import { useSubjects, type Subject } from "@/lib/cloud-subjects";
import { getSettings } from "@/lib/store";
import { formatRelativeTime } from "@/lib/desk";

export default function FlashcardsPage() {
  const { decks, error: decksError, refresh, setDecks } = useDecks();
  const { subjects } = useSubjects();
  const router = useRouter();
  const [generatingFor, setGeneratingFor] = React.useState<string | null>(null);
  const [genError, setGenError] = React.useState<string | null>(null);

  const decksBySubject = React.useMemo(() => {
    const map = new Map<string, FlashcardDeck>();
    (decks ?? []).forEach((d) => map.set(d.subjectId, d));
    return map;
  }, [decks]);

  const eligibleSubjects = React.useMemo(() => {
    if (!subjects) return [];
    return subjects
      .filter((s) => !s.archived)
      .filter((s) => !decksBySubject.has(s.id));
  }, [subjects, decksBySubject]);

  async function handleGenerate(subject: Subject) {
    const apiKey = getSettings().geminiKey;
    if (!apiKey) {
      setGenError("Add your Gemini API key in Settings to generate flashcards.");
      return;
    }
    if (!subject.cheatsheetMarkdown) {
      setGenError(`Generate a cheat sheet for ${subject.name} first.`);
      return;
    }
    setGenError(null);
    setGeneratingFor(subject.id);
    try {
      const { deck } = await generateDeck(subject.id, apiKey);
      router.push(`/flashcards/${deck.id}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Couldn't generate flashcards.");
      setGeneratingFor(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this deck? Cards will be lost.")) return;
    const prev = decks ?? [];
    setDecks(prev.filter((d) => d.id !== id));
    try {
      await deleteDeck(id);
    } catch {
      setDecks(prev);
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
          Flashcards
        </h1>
        <p className="text-sm text-ink-muted sm:text-base">
          One deck per subject. Generated from each subject&apos;s cheat sheet, scheduled with spaced repetition.
        </p>
      </header>

      {decksError ? (
        <ErrorBanner message={decksError} />
      ) : null}
      {genError ? <ErrorBanner message={genError} /> : null}

      {/* Existing decks */}
      {decks === null ? (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-32 rounded-[18px]" />
          ))}
        </div>
      ) : decks.length > 0 ? (
        <section className="mb-8 flex flex-col gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Your decks ({decks.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={() => handleDelete(deck.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Generate-from-subject section */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          {decks && decks.length > 0
            ? "Start a new deck from a subject"
            : "Get started"}
        </h2>
        {subjects === null ? (
          <div className="skeleton h-24 rounded-[18px]" />
        ) : eligibleSubjects.length === 0 && (subjects?.length ?? 0) === 0 ? (
          <NoSubjectsYet />
        ) : eligibleSubjects.length === 0 ? (
          <p className="rounded-[12px] border border-default bg-surface-2/40 px-4 py-6 text-center text-sm text-ink-muted">
            Every subject already has a deck. Add a new subject from the Study Desk to start another.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {eligibleSubjects.map((s) => (
              <SubjectRow
                key={s.id}
                subject={s}
                generating={generatingFor === s.id}
                disabled={generatingFor !== null && generatingFor !== s.id}
                onGenerate={() => handleGenerate(s)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 p-4 text-sm">
      <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" strokeWidth={1.75} />
      <p className="flex-1 text-ink">{message}</p>
    </div>
  );
}

function NoSubjectsYet() {
  return (
    <div className="glow-card flex flex-col items-center gap-3 border border-default border-dashed bg-surface-2/40 px-6 py-12 text-center">
      <Puffer size={96} />
      <h3
        className="text-[1.2rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        No subjects yet
      </h3>
      <p className="max-w-md text-sm text-ink-muted">
        Flashcards are generated from a subject&apos;s cheat sheet. Add a subject first, upload some notes, then generate the cheat sheet — flashcards come from there.
      </p>
      <Button asChild>
        <Link href="/subjects/new">
          Add a subject
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
    </div>
  );
}

function SubjectRow({
  subject,
  generating,
  disabled,
  onGenerate,
}: {
  subject: Subject;
  generating: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const hasSheet = !!subject.cheatsheetMarkdown;
  return (
    <div className="glow-card flex items-center gap-3 border border-default bg-surface p-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-default"
        style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
      >
        <BookOpen className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-ink">
          {subject.name}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-faint">
          {hasSheet ? (
            <>
              <FileText className="h-3 w-3" strokeWidth={2} />
              Cheat sheet ready
            </>
          ) : (
            "No cheat sheet yet"
          )}
        </p>
      </div>

      {hasSheet ? (
        <Button
          onClick={onGenerate}
          disabled={generating || disabled}
          size="sm"
        >
          {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {generating ? "Generating…" : "Generate"}
        </Button>
      ) : (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/subjects/${subject.id}`}>
            Set up
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
      )}
    </div>
  );
}

function DeckCard({ deck, onDelete }: { deck: FlashcardDeck; onDelete: () => void }) {
  const subjectName = deck.subjectName ?? deck.title;
  return (
    <article className="glow-card group flex flex-col gap-3 border border-default bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-default"
          style={{ background: "var(--surface-2)", color: "var(--accent-deep)" }}
        >
          <Layers className="h-5 w-5" strokeWidth={1.75} />
        </div>
        {deck.dueCount > 0 ? (
          <Badge tone="accent">{deck.dueCount} due</Badge>
        ) : (
          <Badge tone="neutral">Caught up</Badge>
        )}
      </header>

      <div className="flex flex-col gap-1">
        <h3
          className="text-[1.25rem] leading-tight text-ink"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
        >
          {subjectName}
        </h3>
        <p className="tabular text-[12px] text-ink-faint">
          {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"} · updated {formatRelativeTime(deck.updatedAt)}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Button asChild className="flex-1">
          <Link href={`/flashcards/${deck.id}`}>
            {deck.dueCount > 0 ? "Study now" : "Review deck"}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </Button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete deck"
          aria-label="Delete deck"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-default text-ink-faint opacity-0 transition-opacity hover:bg-surface-2 hover:text-[color:var(--danger)] group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </article>
  );
}
