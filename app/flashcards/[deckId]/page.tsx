"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  RotateCcw,
  Check,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Puffer } from "@/components/puffer";
import {
  fetchDeck,
  reviewCard,
  type FlashcardDeck,
  type Flashcard,
  type ReviewGrade,
} from "@/lib/cloud-flashcards";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; deck: FlashcardDeck; cards: Flashcard[] };

export default function StudyPage() {
  const params = useParams<{ deckId: string }>();
  const router = useRouter();
  const deckId = params.deckId;

  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [queue, setQueue] = React.useState<Flashcard[]>([]);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [completed, setCompleted] = React.useState(0);

  // Load the deck + filter to "due today" cards (or all cards if none due).
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetchDeck(deckId);
        if (cancelled) return;
        if (!result) {
          setState({ kind: "missing" });
          return;
        }
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const due = result.cards.filter((c) => c.dueDate <= todayStr);
        const studyQueue = due.length > 0 ? due : result.cards;
        setState({ kind: "ready", deck: result.deck, cards: result.cards });
        setQueue(shuffle(studyQueue));
        setIndex(0);
        setFlipped(false);
        setCompleted(0);
      } catch {
        setState({ kind: "missing" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  if (state.kind === "loading") {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="skeleton h-64 rounded-[18px]" />
      </div>
    );
  }

  if (state.kind === "missing") {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-16 text-center sm:px-8">
        <h1 className="mb-2 text-xl font-semibold text-ink">Deck not found</h1>
        <p className="mb-6 text-ink-muted">It may have been deleted, or the deck never existed.</p>
        <Button asChild>
          <Link href="/flashcards">Back to flashcards</Link>
        </Button>
      </div>
    );
  }

  const current = queue[index] ?? null;
  const allDone = !current && queue.length > 0;

  async function handleGrade(grade: ReviewGrade) {
    if (!current) return;
    setFlipped(false);
    setIndex((i) => i + 1);
    setCompleted((c) => c + 1);
    // Persist in the background; if it fails, the user can re-grade next session.
    try {
      await reviewCard(current.id, grade);
    } catch (err) {
      console.error("reviewCard failed:", err);
    }
  }

  function restart() {
    if (state.kind !== "ready") return;
    setQueue(shuffle(state.cards));
    setIndex(0);
    setFlipped(false);
    setCompleted(0);
  }

  return (
    <div className="animate-fade-up mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-12">
      <Link
        href="/flashcards"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to flashcards
      </Link>

      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <Badge tone="accent" className="self-start">
            <Sparkles className="mr-1 h-3 w-3" strokeWidth={2} />
            Flashcards
          </Badge>
          <h1
            className="text-[1.8rem] leading-tight tracking-tight text-ink sm:text-[2.2rem]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
          >
            {state.deck.subjectName ?? state.deck.title}
          </h1>
        </div>
        <p className="tabular text-sm text-ink-faint">
          {queue.length === 0
            ? "0 cards in this deck"
            : allDone
              ? `${completed} reviewed`
              : `Card ${index + 1} of ${queue.length}`}
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyDeck />
      ) : allDone ? (
        <SessionComplete completed={completed} onRestart={restart} />
      ) : current ? (
        <StudyCard
          card={current}
          flipped={flipped}
          onFlip={() => setFlipped((v) => !v)}
          onGrade={handleGrade}
        />
      ) : null}
    </div>
  );
}

function StudyCard({
  card,
  flipped,
  onFlip,
  onGrade,
}: {
  card: Flashcard;
  flipped: boolean;
  onFlip: () => void;
  onGrade: (g: ReviewGrade) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Show front" : "Reveal answer"}
        className="flip-scene w-full"
      >
        <div className={`flip-card ${flipped ? "flip-card--flipped" : ""}`}>
          {/* Front face */}
          <div className="flip-face glow-card flex min-h-[260px] w-full flex-col items-center justify-center border border-default bg-surface p-8 text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Front
            </p>
            <p
              className="mt-4 text-[1.4rem] leading-tight text-ink"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {card.front}
            </p>
            <p className="mt-6 text-[12px] text-ink-faint">Click anywhere to reveal</p>
          </div>
          {/* Back face */}
          <div className="flip-face flip-face--back glow-card flex min-h-[260px] w-full flex-col items-center justify-center border border-default bg-surface p-8 text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
              Back
            </p>
            <p
              className="mt-4 text-[1.4rem] leading-tight text-ink"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
            >
              {card.back}
            </p>
          </div>
        </div>
      </button>

      {flipped ? (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="danger" onClick={() => onGrade("again")}>
            Again
          </Button>
          <Button variant="secondary" onClick={() => onGrade("good")}>
            Good
          </Button>
          <Button onClick={() => onGrade("easy")}>Easy</Button>
        </div>
      ) : (
        <Button size="lg" onClick={onFlip} className="w-full">
          Reveal answer
        </Button>
      )}
    </div>
  );
}

function EmptyDeck() {
  return (
    <div className="glow-card flex flex-col items-center gap-3 border border-default border-dashed bg-surface-2/40 px-6 py-16 text-center">
      <p className="text-sm text-ink-muted">This deck has no cards. Regenerate it from the subject page.</p>
    </div>
  );
}

function SessionComplete({
  completed,
  onRestart,
}: {
  completed: number;
  onRestart: () => void;
}) {
  return (
    <div className="animate-scale-in glow-card flex flex-col items-center gap-3 border border-default bg-surface px-6 py-16 text-center">
      <Puffer size={112} mood="happy" />
      <h2
        className="text-[1.5rem] leading-tight"
        style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}
      >
        Session complete
      </h2>
      <p className="max-w-md text-sm text-ink-muted">
        You reviewed {completed} card{completed === 1 ? "" : "s"}. Cards you marked &quot;Again&quot; will be back tomorrow; others will reappear based on how you rated them.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onRestart}>
          <RotateCcw />
          Study again
        </Button>
        <Button asChild>
          <Link href="/flashcards">
            <Check />
            Done
          </Link>
        </Button>
      </div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
