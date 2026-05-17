import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { deleteFile, updateFileCaption } from "@/lib/subjects-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId } = await params;
  let body: { caption?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.caption !== "string") {
    return NextResponse.json({ error: "caption_required" }, { status: 400 });
  }

  const updated = await updateFileCaption(userId, fileId, body.caption);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ file: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fileId } = await params;
  const removed = await deleteFile(userId, fileId);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await del(removed.blob_url).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
