import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listDecksWithStats } from "@/lib/flashcards-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const decks = await listDecksWithStats(userId);
  return NextResponse.json({ decks });
}
