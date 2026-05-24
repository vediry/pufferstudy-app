"use client";

import * as React from "react";

export type FlashcardDeck = {
  id: string;
  subjectId: string;
  subjectName: string | null;
  title: string;
  cardCount: number;
  dueCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Flashcard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  position: number;
  ease: number;
  intervalDays: number;
  dueDate: string;
  reviews: number;
  lastGrade: number | null;
  createdAt: string;
  updatedAt: string;
};

type DbDeck = {
  id: string;
  subject_id: string;
  subject_name: string | null;
  title: string;
  card_count: number;
  due_count: number;
  created_at: string;
  updated_at: string;
};

type DbCard = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  position: number;
  ease: number;
  interval_days: number;
  due_date: string;
  reviews: number;
  last_grade: number | null;
  created_at: string;
  updated_at: string;
};

function mapDeck(row: DbDeck): FlashcardDeck {
  return {
    id: row.id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    title: row.title,
    cardCount: row.card_count,
    dueCount: row.due_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCard(row: DbCard): Flashcard {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    position: row.position,
    ease: row.ease,
    intervalDays: row.interval_days,
    dueDate: row.due_date,
    reviews: row.reviews,
    lastGrade: row.last_grade,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchDecks(): Promise<FlashcardDeck[]> {
  const res = await fetch("/api/flashcards/decks", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchDecks ${res.status}`);
  const data = (await res.json()) as { decks: DbDeck[] };
  return data.decks.map(mapDeck);
}

export async function fetchDeck(id: string): Promise<{ deck: FlashcardDeck; cards: Flashcard[] } | null> {
  const res = await fetch(`/api/flashcards/decks/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchDeck ${res.status}`);
  const data = (await res.json()) as { deck: DbDeck & { subject_name?: string | null }; cards: DbCard[] };
  return {
    deck: mapDeck({ ...data.deck, card_count: data.cards.length, due_count: 0, subject_name: data.deck.subject_name ?? null }),
    cards: data.cards.map(mapCard),
  };
}

export async function deleteDeck(id: string): Promise<void> {
  const res = await fetch(`/api/flashcards/decks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteDeck ${res.status}`);
}

export async function generateDeck(
  subjectId: string,
  apiKey: string,
): Promise<{ deck: FlashcardDeck; cardCount: number }> {
  const res = await fetch("/api/flashcards/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectId, apiKey }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? `generateDeck ${res.status}`);
  }
  const data = (await res.json()) as { deck: DbDeck; cardCount: number };
  return {
    deck: mapDeck({ ...data.deck, card_count: data.cardCount, due_count: data.cardCount, subject_name: null }),
    cardCount: data.cardCount,
  };
}

export type ReviewGrade = "again" | "good" | "easy";

export async function reviewCard(cardId: string, grade: ReviewGrade): Promise<Flashcard> {
  const res = await fetch(`/api/flashcards/cards/${cardId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grade }),
  });
  if (!res.ok) throw new Error(`reviewCard ${res.status}`);
  const data = (await res.json()) as { card: DbCard };
  return mapCard(data.card);
}

export function useDecks() {
  const [decks, setDecks] = React.useState<FlashcardDeck[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const list = await fetchDecks();
      setDecks(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load decks.");
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { decks, error, refresh, setDecks };
}
