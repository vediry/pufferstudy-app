import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCard, reviewCard } from "@/lib/flashcards-db";
import { gradeFromName, nextDueDate, nextSchedule, type GradeName } from "@/lib/spaced-repetition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isGradeName(value: unknown): value is GradeName {
  return value === "again" || value === "good" || value === "easy";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { grade?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isGradeName(body.grade)) {
    return NextResponse.json({ error: "invalid_grade" }, { status: 400 });
  }

  const card = await getCard(userId, id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const grade = gradeFromName(body.grade);
  const next = nextSchedule({
    ease: card.ease,
    intervalDays: card.interval_days,
    reviews: card.reviews,
    grade,
  });
  const dueDate = nextDueDate(next.intervalDays);
  const updated = await reviewCard(userId, id, {
    ease: next.ease,
    intervalDays: next.intervalDays,
    reviews: next.reviews,
    dueDate,
    grade,
  });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ card: updated });
}
