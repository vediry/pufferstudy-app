import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getQuiz, deleteQuiz } from "@/lib/practice-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const quiz = await getQuiz(userId, id);
  if (!quiz) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Strip correct answers so the client can't peek before submit.
  const sanitized = {
    id: quiz.id,
    subjectId: quiz.subject_id,
    title: quiz.title,
    createdAt: quiz.created_at,
    questions: quiz.questions.map((q) => {
      if (q.kind === "multiple_choice") {
        return {
          kind: "multiple_choice" as const,
          prompt: q.prompt,
          choices: q.choices,
          topic: q.topic,
        };
      }
      return {
        kind: "short_answer" as const,
        prompt: q.prompt,
        topic: q.topic,
      };
    }),
  };

  return NextResponse.json({ quiz: sanitized });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteQuiz(userId, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
