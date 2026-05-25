"use client";

import * as React from "react";

export type QuizSummary = {
  id: string;
  subjectId: string;
  title: string;
  questionCount: number;
  createdAt: string;
};

export type MultipleChoicePrompt = {
  kind: "multiple_choice";
  prompt: string;
  choices: string[];
  topic: string;
};

export type ShortAnswerPrompt = {
  kind: "short_answer";
  prompt: string;
  topic: string;
};

export type QuizForUser = {
  id: string;
  subjectId: string;
  title: string;
  createdAt: string;
  questions: Array<MultipleChoicePrompt | ShortAnswerPrompt>;
};

export type FeedbackItem =
  | {
      index: number;
      kind: "multiple_choice";
      userAnswer: string;
      isCorrect: boolean;
      correctChoice: string;
      correctIndex: number;
      topic: string;
    }
  | {
      index: number;
      kind: "short_answer";
      userAnswer: string;
      isCorrect: boolean;
      expectedAnswer: string;
      topic: string;
    };

export type AttemptResult = {
  id: string;
  scoreTotal: number;
  scoreMax: number;
  topicAcc: Record<string, { correct: number; total: number }>;
  completedAt: string;
};

export type SubjectStats = {
  id: string;
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  attempts: number;
};

export type TopicStats = {
  topic: string;
  correct: number;
  total: number;
  accuracy: number;
};

export type RecentAttempt = {
  id: string;
  subjectId: string;
  subjectName: string | null;
  quizTitle: string;
  scoreTotal: number;
  scoreMax: number;
  completedAt: string;
};

export type PracticeStats = {
  overall: {
    totalAttempts: number;
    scoreTotal: number;
    scoreMax: number;
    accuracy: number;
  };
  subjects: SubjectStats[];
  weakest: TopicStats[];
  recent: RecentAttempt[];
};

export async function fetchQuizzes(): Promise<QuizSummary[]> {
  const res = await fetch("/api/practice/quizzes", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchQuizzes ${res.status}`);
  const data = (await res.json()) as { quizzes: QuizSummary[] };
  return data.quizzes;
}

export async function fetchQuiz(id: string): Promise<QuizForUser | null> {
  const res = await fetch(`/api/practice/quizzes/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchQuiz ${res.status}`);
  const data = (await res.json()) as { quiz: QuizForUser };
  return data.quiz;
}

export async function deleteQuiz(id: string): Promise<void> {
  const res = await fetch(`/api/practice/quizzes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteQuiz ${res.status}`);
}

export async function generateQuiz(subjectId: string, apiKey: string): Promise<QuizSummary> {
  const res = await fetch("/api/practice/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectId, apiKey }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? `generateQuiz ${res.status}`);
  }
  const data = (await res.json()) as {
    quiz: { id: string; subject_id: string; title: string; questions: unknown[]; created_at: string };
  };
  return {
    id: data.quiz.id,
    subjectId: data.quiz.subject_id,
    title: data.quiz.title,
    questionCount: data.quiz.questions.length,
    createdAt: data.quiz.created_at,
  };
}

export async function submitAttempt(
  quizId: string,
  apiKey: string,
  responses: Array<{ index: number; userAnswer: string }>,
): Promise<{ attempt: AttemptResult; feedback: FeedbackItem[] }> {
  const res = await fetch(`/api/practice/quizzes/${quizId}/attempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, responses }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message ?? `submitAttempt ${res.status}`);
  }
  return (await res.json()) as { attempt: AttemptResult; feedback: FeedbackItem[] };
}

export async function fetchStats(): Promise<PracticeStats> {
  const res = await fetch("/api/practice/stats", { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchStats ${res.status}`);
  return (await res.json()) as PracticeStats;
}

export function usePracticeStats() {
  const [stats, setStats] = React.useState<PracticeStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load stats.");
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, error, refresh };
}
