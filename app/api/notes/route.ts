import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createNote, listNotes } from "@/lib/notes-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const notes = await listNotes(userId);
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { title?: string; content?: string };
  try {
    body = (await req.json()) as { title?: string; content?: string };
  } catch {
    body = {};
  }

  const note = await createNote(userId, {
    title: typeof body.title === "string" ? body.title : "",
    content: typeof body.content === "string" ? body.content : "",
  });
  return NextResponse.json({ note });
}
