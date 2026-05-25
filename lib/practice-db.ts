import "server-only";
import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";

export type MultipleChoiceQuestion = {
  kind: "multiple_choice";
  prompt: string;
  choices: string[];
  correctIndex: number;
  topic: string;
};

export type ShortAnswerQuestion = {
  kind: "short_answer";
  prompt: string;
  expectedAnswer: string;
  topic: string;
};

export type QuizQuestion = MultipleChoiceQuestion | ShortAnswerQuestion;

export type DbQuiz = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  questions: QuizQuestion[];
  created_at: string;
  updated_at: string;
};

export type QuizResponse = {
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
};

export type DbAttempt = {
  id: string;
  user_id: string;
  quiz_id: string;
  subject_id: string;
  responses: QuizResponse[];
  topic_acc: Record<string, { correct: number; total: number }>;
  score_total: number;
  score_max: number;
  completed_at: string;
};

export async function listQuizzes(userId: string): Promise<DbQuiz[]> {
  const { rows } = await sql<DbQuiz>`
    SELECT * FROM quizzes
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function getQuiz(userId: string, id: string): Promise<DbQuiz | null> {
  const { rows } = await sql<DbQuiz>`
    SELECT * FROM quizzes WHERE id = ${id} AND user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function createQuiz(
  userId: string,
  subjectId: string,
  title: string,
  questions: QuizQuestion[],
): Promise<DbQuiz> {
  const id = randomUUID();
  const { rows } = await sql<DbQuiz>`
    INSERT INTO quizzes (id, user_id, subject_id, title, questions)
    VALUES (${id}, ${userId}, ${subjectId}, ${title}, ${JSON.stringify(questions)}::jsonb)
    RETURNING *
  `;
  return rows[0];
}

export async function deleteQuiz(userId: string, id: string): Promise<boolean> {
  await sql`DELETE FROM quiz_attempts WHERE quiz_id = ${id} AND user_id = ${userId}`;
  const { rowCount } = await sql`
    DELETE FROM quizzes WHERE id = ${id} AND user_id = ${userId}
  `;
  return (rowCount ?? 0) > 0;
}

export async function recordAttempt(
  userId: string,
  quizId: string,
  subjectId: string,
  responses: QuizResponse[],
  topicAcc: Record<string, { correct: number; total: number }>,
): Promise<DbAttempt> {
  const id = randomUUID();
  const scoreTotal = responses.filter((r) => r.isCorrect).length;
  const scoreMax = responses.length;
  const { rows } = await sql<DbAttempt>`
    INSERT INTO quiz_attempts (id, user_id, quiz_id, subject_id, responses, topic_acc, score_total, score_max)
    VALUES (
      ${id},
      ${userId},
      ${quizId},
      ${subjectId},
      ${JSON.stringify(responses)}::jsonb,
      ${JSON.stringify(topicAcc)}::jsonb,
      ${scoreTotal},
      ${scoreMax}
    )
    RETURNING *
  `;
  return rows[0];
}

export type AttemptWithSubject = DbAttempt & { subject_name: string | null; quiz_title: string };

export async function listAttempts(
  userId: string,
  limit = 50,
): Promise<AttemptWithSubject[]> {
  const safeLimit = Math.max(1, Math.min(200, limit | 0));
  const { rows } = await sql<AttemptWithSubject>`
    SELECT
      a.*,
      s.name AS subject_name,
      q.title AS quiz_title
    FROM quiz_attempts a
    LEFT JOIN subjects s ON s.id::text = a.subject_id
    LEFT JOIN quizzes  q ON q.id = a.quiz_id
    WHERE a.user_id = ${userId}
    ORDER BY a.completed_at DESC
    LIMIT ${safeLimit}
  `;
  return rows;
}
