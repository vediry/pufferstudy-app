import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listAttempts } from "@/lib/practice-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const attempts = await listAttempts(userId, 100);

  // Aggregate: totals, per-subject, per-topic.
  let scoreTotal = 0;
  let scoreMax = 0;
  const perSubject = new Map<
    string,
    { name: string; correct: number; total: number; attempts: number }
  >();
  const perTopic = new Map<string, { correct: number; total: number }>();

  for (const a of attempts) {
    scoreTotal += a.score_total;
    scoreMax += a.score_max;

    const subjKey = a.subject_id;
    const subj = perSubject.get(subjKey) ?? {
      name: a.subject_name ?? a.quiz_title ?? "Unknown subject",
      correct: 0,
      total: 0,
      attempts: 0,
    };
    subj.correct += a.score_total;
    subj.total += a.score_max;
    subj.attempts += 1;
    perSubject.set(subjKey, subj);

    for (const [topic, acc] of Object.entries(a.topic_acc ?? {})) {
      const t = perTopic.get(topic) ?? { correct: 0, total: 0 };
      t.correct += acc.correct;
      t.total += acc.total;
      perTopic.set(topic, t);
    }
  }

  const subjects = [...perSubject.entries()].map(([id, s]) => ({
    id,
    name: s.name,
    correct: s.correct,
    total: s.total,
    accuracy: s.total > 0 ? s.correct / s.total : 0,
    attempts: s.attempts,
  }));

  const topics = [...perTopic.entries()].map(([topic, t]) => ({
    topic,
    correct: t.correct,
    total: t.total,
    accuracy: t.total > 0 ? t.correct / t.total : 0,
  }));

  // Improvement suggestions: weakest topics with at least 2 attempts at that topic.
  const weakest = topics
    .filter((t) => t.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const recent = attempts.slice(0, 10).map((a) => ({
    id: a.id,
    subjectId: a.subject_id,
    subjectName: a.subject_name,
    quizTitle: a.quiz_title,
    scoreTotal: a.score_total,
    scoreMax: a.score_max,
    completedAt: a.completed_at,
  }));

  return NextResponse.json({
    overall: {
      totalAttempts: attempts.length,
      scoreTotal,
      scoreMax,
      accuracy: scoreMax > 0 ? scoreTotal / scoreMax : 0,
    },
    subjects,
    weakest,
    recent,
  });
}
