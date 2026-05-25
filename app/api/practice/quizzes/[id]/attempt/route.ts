import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getQuiz, recordAttempt, type QuizResponse } from "@/lib/practice-db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GRADE_SYSTEM = `You are grading short-answer quiz responses.

You will receive a JSON array of items, each with:
- index: the question index (number)
- expectedAnswer: the canonical correct answer
- userAnswer: what the student wrote

Return ONLY a JSON object mapping index -> boolean (correct or not).
A response is "correct" if it captures the same key idea as expected, even
with different wording. Minor omissions don't count against the student.
Outright wrong, blank, or off-topic answers are false.

Example output:
{"0": true, "1": false, "2": true}`;

type AttemptPayload = {
  apiKey?: unknown;
  responses?: unknown;
};

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return bad(401, "Sign in first.", "unauthorized");
  const { id: quizId } = await params;

  const quiz = await getQuiz(userId, quizId);
  if (!quiz) return bad(404, "Quiz not found.", "not_found");

  let body: AttemptPayload;
  try {
    body = (await req.json()) as AttemptPayload;
  } catch {
    return bad(400, "Request body must be valid JSON.");
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  if (apiKey.length < 10) return bad(401, "Missing or invalid API key.", "invalid_key");

  if (!Array.isArray(body.responses)) return bad(400, "responses must be an array.");
  const rawResponses = body.responses as Array<{ index?: unknown; userAnswer?: unknown }>;

  // Normalize: align by question index in the saved quiz.
  type Pending = { idx: number; userAnswer: string };
  const pending: Pending[] = [];
  for (const r of rawResponses) {
    const idx = typeof r.index === "number" ? r.index : -1;
    const userAnswer = typeof r.userAnswer === "string" ? r.userAnswer : "";
    if (idx < 0 || idx >= quiz.questions.length) continue;
    pending.push({ idx, userAnswer });
  }

  // Server-grade multiple choice immediately; collect short answers for AI grading.
  type SAItem = { index: number; expectedAnswer: string; userAnswer: string };
  const saItems: SAItem[] = [];
  const grades = new Map<number, boolean>();

  for (const p of pending) {
    const q = quiz.questions[p.idx];
    if (q.kind === "multiple_choice") {
      const chosen = Number.parseInt(p.userAnswer, 10);
      const ok = Number.isFinite(chosen) && chosen === q.correctIndex;
      grades.set(p.idx, ok);
    } else {
      saItems.push({
        index: p.idx,
        expectedAnswer: q.expectedAnswer,
        userAnswer: p.userAnswer,
      });
    }
  }

  // Batch-grade short answers in one Gemini call.
  if (saItems.length > 0) {
    const blanks = saItems.filter((i) => !i.userAnswer.trim());
    for (const b of blanks) grades.set(b.index, false);
    const toGrade = saItems.filter((i) => i.userAnswer.trim());

    if (toGrade.length > 0) {
      const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        MODEL,
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const res = await fetch(upstream, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: GRADE_SYSTEM }] },
            contents: [
              {
                role: "user",
                parts: [{ text: JSON.stringify(toGrade) }],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
              maxOutputTokens: 1024,
            },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            for (const item of toGrade) {
              const key = String(item.index);
              const val = parsed[key];
              grades.set(item.index, val === true);
            }
          } catch {
            // Couldn't parse — fall back to marking all short answers wrong.
            for (const item of toGrade) grades.set(item.index, false);
          }
        } else {
          // Grading API failed — mark as wrong; user can dispute later.
          for (const item of toGrade) grades.set(item.index, false);
        }
      } catch {
        for (const item of toGrade) grades.set(item.index, false);
      }
    }
  }

  // Build the response array in the original order, compute topic accuracy.
  const responses: QuizResponse[] = [];
  const topicAcc: Record<string, { correct: number; total: number }> = {};
  for (const p of pending) {
    const ok = grades.get(p.idx) ?? false;
    responses.push({
      questionIndex: p.idx,
      userAnswer: p.userAnswer,
      isCorrect: ok,
    });
    const topic = quiz.questions[p.idx].topic || "General";
    if (!topicAcc[topic]) topicAcc[topic] = { correct: 0, total: 0 };
    topicAcc[topic].total += 1;
    if (ok) topicAcc[topic].correct += 1;
  }

  const attempt = await recordAttempt(
    userId,
    quizId,
    quiz.subject_id,
    responses,
    topicAcc,
  );

  void logActivity({
    userId,
    subjectId: quiz.subject_id,
    type: "practice_completed",
    data: { score: attempt.score_total, max: attempt.score_max },
  });

  // Return graded results + the correct answers so the client can show feedback.
  const feedback = pending.map((p) => {
    const q = quiz.questions[p.idx];
    if (q.kind === "multiple_choice") {
      return {
        index: p.idx,
        kind: "multiple_choice" as const,
        userAnswer: p.userAnswer,
        isCorrect: grades.get(p.idx) ?? false,
        correctChoice: q.choices[q.correctIndex],
        correctIndex: q.correctIndex,
        topic: q.topic,
      };
    }
    return {
      index: p.idx,
      kind: "short_answer" as const,
      userAnswer: p.userAnswer,
      isCorrect: grades.get(p.idx) ?? false,
      expectedAnswer: q.expectedAnswer,
      topic: q.topic,
    };
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      scoreTotal: attempt.score_total,
      scoreMax: attempt.score_max,
      topicAcc,
      completedAt: attempt.completed_at,
    },
    feedback,
  });
}
