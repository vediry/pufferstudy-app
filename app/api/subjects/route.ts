import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSubject, listSubjects } from "@/lib/subjects-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const subjects = await listSubjects(userId);
  return NextResponse.json({ subjects });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { name?: string; testLabel?: string | null; testDate?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "name_too_long" }, { status: 400 });

  const subject = await createSubject(userId, {
    name,
    testLabel: body.testLabel?.toString().trim() || null,
    testDate: body.testDate?.toString().trim() || null,
  });
  return NextResponse.json({ subject });
}
