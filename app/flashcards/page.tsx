"use client";

import * as React from "react";
import Link from "next/link";
import { Layers, ArrowRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDecks, deleteDeck, type FlashcardDeck } from "@/lib/cloud-flashcards";
import { formatRelativeTime } from "@/lib/desk";

export default function FlashcardsPage() {
  const { decks, error, refresh, setDecks } = useDecks();

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

      {error ? (
        <div className="mb-4 rounded-[12px] border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}

      {decks === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-[14px] bg-surface-2/60" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={() => handleDelete(deck.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glow-card flex flex-col items-center gap-3 border border-default border-dashed bg-surface-2/40 px-6 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-default"
        style={{ background: "var(--surface)", color: "var(--accent-deep)" }}
      >
        <Layers className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h2
        className="text-[1.4rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        No decks yet
      </h2>
      <p className="max-w-md text-sm text-ink-muted">
        Open a subject that already has a cheat sheet and tap{" "}
        <span className="font-semibold text-ink">Generate flashcards</span> to turn it into a study deck.
      </p>
      <Button asChild>
        <Link href="/">
          Pick a subject
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </Button>
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
