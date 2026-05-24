import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteNote, getNote, updateNote } from "@/lib/notes-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const note = await getNote(userId, id);
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: { title?: string; content?: string } = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.content === "string") patch.content = body.content;

  const note = await updateNote(userId, id, patch);
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteNote(userId, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
