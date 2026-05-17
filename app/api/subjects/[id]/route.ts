import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { deleteSubject, getSubjectWithFiles, updateSubject } from "@/lib/subjects-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const subject = await getSubjectWithFiles(userId, id);
  if (!subject) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ subject });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { name?: string; testLabel?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: { name?: string; testLabel?: string | null } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (trimmed.length > 120) return NextResponse.json({ error: "name_too_long" }, { status: 400 });
    patch.name = trimmed;
  }
  if (body.testLabel !== undefined) {
    patch.testLabel = body.testLabel?.toString().trim() || null;
  }

  const updated = await updateSubject(userId, id, patch);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ subject: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const removedFiles = await deleteSubject(userId, id);

  await Promise.all(
    removedFiles.map((f) => del(f.blob_url).catch(() => undefined)),
  );

  return NextResponse.json({ ok: true, removedFileCount: removedFiles.length });
}
