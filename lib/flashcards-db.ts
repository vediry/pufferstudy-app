import "server-only";
import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";

export type DbFlashcardDeck = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type DbFlashcard = {
  id: string;
  deck_id: string;
  user_id: string;
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

export type DeckWithStats = DbFlashcardDeck & {
  card_count: number;
  due_count: number;
  subject_name: string | null;
};

export async function listDecksWithStats(userId: string): Promise<DeckWithStats[]> {
  const { rows } = await sql<DeckWithStats>`
    SELECT
      d.id, d.user_id, d.subject_id, d.title, d.created_at, d.updated_at,
      COALESCE(c.card_count, 0)::int  AS card_count,
      COALESCE(c.due_count, 0)::int   AS due_count,
      s.name AS subject_name
    FROM flashcard_decks d
    LEFT JOIN (
      SELECT deck_id,
             COUNT(*)                                         AS card_count,
             COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE) AS due_count
      FROM flashcards
      GROUP BY deck_id
    ) c ON c.deck_id = d.id
    LEFT JOIN subjects s ON s.id::text = d.subject_id
    WHERE d.user_id = ${userId}
    ORDER BY d.updated_at DESC
  `;
  return rows;
}

export async function getDeck(userId: string, deckId: string): Promise<DbFlashcardDeck | null> {
  const { rows } = await sql<DbFlashcardDeck>`
    SELECT * FROM flashcard_decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function getDeckBySubject(
  userId: string,
  subjectId: string,
): Promise<DbFlashcardDeck | null> {
  const { rows } = await sql<DbFlashcardDeck>`
    SELECT * FROM flashcard_decks
    WHERE user_id = ${userId} AND subject_id = ${subjectId}
  `;
  return rows[0] ?? null;
}

export async function listCardsForDeck(
  userId: string,
  deckId: string,
): Promise<DbFlashcard[]> {
  const { rows } = await sql<DbFlashcard>`
    SELECT * FROM flashcards
    WHERE user_id = ${userId} AND deck_id = ${deckId}
    ORDER BY position ASC, created_at ASC
  `;
  return rows;
}

export async function getCard(
  userId: string,
  cardId: string,
): Promise<DbFlashcard | null> {
  const { rows } = await sql<DbFlashcard>`
    SELECT * FROM flashcards WHERE id = ${cardId} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

/**
 * Replace the existing deck for (user, subject) with a fresh set of cards.
 * Atomic: delete old cards, upsert deck, insert new cards.
 */
export async function replaceDeck(
  userId: string,
  subjectId: string,
  title: string,
  cards: Array<{ front: string; back: string }>,
): Promise<{ deck: DbFlashcardDeck; insertedCards: number }> {
  // Upsert the deck row.
  const existing = await getDeckBySubject(userId, subjectId);
  let deck: DbFlashcardDeck;
  if (existing) {
    const { rows } = await sql<DbFlashcardDeck>`
      UPDATE flashcard_decks
      SET title = ${title}, updated_at = now()
      WHERE id = ${existing.id} AND user_id = ${userId}
      RETURNING *
    `;
    deck = rows[0];
    // Drop the old cards so the new generation completely replaces them.
    await sql`DELETE FROM flashcards WHERE deck_id = ${existing.id} AND user_id = ${userId}`;
  } else {
    const id = randomUUID();
    const { rows } = await sql<DbFlashcardDeck>`
      INSERT INTO flashcard_decks (id, user_id, subject_id, title)
      VALUES (${id}, ${userId}, ${subjectId}, ${title})
      RETURNING *
    `;
    deck = rows[0];
  }

  let inserted = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const cardId = randomUUID();
    await sql`
      INSERT INTO flashcards (id, deck_id, user_id, front, back, position)
      VALUES (${cardId}, ${deck.id}, ${userId}, ${c.front}, ${c.back}, ${i})
    `;
    inserted++;
  }

  return { deck, insertedCards: inserted };
}

export async function deleteDeck(userId: string, deckId: string): Promise<boolean> {
  await sql`DELETE FROM flashcards WHERE deck_id = ${deckId} AND user_id = ${userId}`;
  const { rowCount } = await sql`
    DELETE FROM flashcard_decks WHERE id = ${deckId} AND user_id = ${userId}
  `;
  return (rowCount ?? 0) > 0;
}

export async function reviewCard(
  userId: string,
  cardId: string,
  next: { ease: number; intervalDays: number; reviews: number; dueDate: string; grade: number },
): Promise<DbFlashcard | null> {
  const { rows } = await sql<DbFlashcard>`
    UPDATE flashcards
    SET
      ease = ${next.ease},
      interval_days = ${next.intervalDays},
      reviews = ${next.reviews},
      due_date = ${next.dueDate}::date,
      last_grade = ${next.grade},
      updated_at = now()
    WHERE id = ${cardId} AND user_id = ${userId}
    RETURNING *
  `;
  return rows[0] ?? null;
}
