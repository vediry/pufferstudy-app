import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listQuizzes } from "@/lib/practice-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const quizzes = await listQuizzes(userId);
  // Strip answers from the response — clients shouldn't see correct answers
  // until they submit.
  const safe = quizzes.map((q) => ({
    id: q.id,
    subjectId: q.subject_id,
    title: q.title,
    questionCount: q.questions.length,
    createdAt: q.created_at,
  }));
  return NextResponse.json({ quizzes: safe });
}
