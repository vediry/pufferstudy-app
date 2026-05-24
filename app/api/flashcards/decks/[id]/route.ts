import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteDeck, getDeck, listCardsForDeck } from "@/lib/flashcards-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const deck = await getDeck(userId, id);
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const cards = await listCardsForDeck(userId, id);
  return NextResponse.json({ deck, cards });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteDeck(userId, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
