import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const parsed = rawLimit ? Number.parseInt(rawLimit, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 10;

  const events = await listActivity(userId, limit);
  return NextResponse.json({ events });
}
