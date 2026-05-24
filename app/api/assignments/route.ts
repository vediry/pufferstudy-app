import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAssignment, listAssignments } from "@/lib/assignments-db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const assignments = await listAssignments(userId);
  return NextResponse.json({ assignments });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { title?: unknown; description?: unknown; dueDate?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "title_too_long" }, { status: 400 });

  const description = typeof body.description === "string" ? body.description : "";
  const dueDate =
    typeof body.dueDate === "string" && body.dueDate.trim().length > 0
      ? body.dueDate.trim()
      : null;

  const assignment = await createAssignment(userId, { title, description, dueDate });
  void logActivity({
    userId,
    subjectId: null,
    type: "assignment_created",
    data: { title: assignment.title },
  });
  return NextResponse.json({ assignment });
}
