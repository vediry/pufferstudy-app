import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { deleteSubject, getSubjectWithFiles, updateSubject } from "@/lib/subjects-db";
import type { ChatMessage } from "@/types";

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
  let body: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
    archived?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: {
    name?: string;
    testLabel?: string | null;
    testDate?: string | null;
    cheatsheetMarkdown?: string | null;
    chatMessages?: ChatMessage[];
    archived?: boolean;
  } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (trimmed.length > 120) return NextResponse.json({ error: "name_too_long" }, { status: 400 });
    patch.name = trimmed;
  }
  if (body.testLabel !== undefined) {
    patch.testLabel = body.testLabel?.toString().trim() || null;
  }
  if (body.testDate !== undefined) {
    patch.testDate = body.testDate?.toString().trim() || null;
  }
  if (body.cheatsheetMarkdown !== undefined) {
    patch.cheatsheetMarkdown = body.cheatsheetMarkdown;
  }
  if (body.chatMessages !== undefined) {
    if (!Array.isArray(body.chatMessages)) {
      return NextResponse.json({ error: "chat_messages_invalid" }, { status: 400 });
    }
    // Light shape validation to keep junk out of the JSONB column.
    for (const m of body.chatMessages) {
      if (
        !m ||
        typeof m !== "object" ||
        (m.role !== "user" && m.role !== "assistant") ||
        typeof m.content !== "string" ||
        typeof m.ts !== "string"
      ) {
        return NextResponse.json({ error: "chat_message_shape" }, { status: 400 });
      }
    }
    patch.chatMessages = body.chatMessages;
  }
  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json({ error: "archived_must_be_boolean" }, { status: 400 });
    }
    patch.archived = body.archived;
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
