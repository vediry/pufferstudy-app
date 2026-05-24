import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  deleteAssignment,
  getAssignment,
  updateAssignment,
  type AssignmentStatus,
} from "@/lib/assignments-db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStatus(value: unknown): value is AssignmentStatus {
  return value === "todo" || value === "in_progress" || value === "done";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const assignment = await getAssignment(userId, id);
  if (!assignment) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ assignment });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: { title?: unknown; description?: unknown; dueDate?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const patch: {
    title?: string;
    description?: string;
    dueDate?: string | null;
    status?: AssignmentStatus;
  } = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "title_required" }, { status: 400 });
    patch.title = t;
  }
  if (typeof body.description === "string") patch.description = body.description;
  if (body.dueDate !== undefined) {
    patch.dueDate =
      typeof body.dueDate === "string" && body.dueDate.trim().length > 0
        ? body.dueDate.trim()
        : null;
  }
  if (body.status !== undefined) {
    if (!isStatus(body.status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    patch.status = body.status;
  }

  const prev = await getAssignment(userId, id);
  if (!prev) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const assignment = await updateAssignment(userId, id, patch);
  if (!assignment) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Log completion only on the transition todo/in_progress -> done.
  if (patch.status === "done" && prev.status !== "done") {
    void logActivity({
      userId,
      subjectId: null,
      type: "assignment_completed",
      data: { title: assignment.title },
    });
  }

  return NextResponse.json({ assignment });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteAssignment(userId, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
