import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { createFile, ownsSubject } from "@/lib/subjects-db";
import { logActivity } from "@/lib/activity";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB hard cap per upload
const ALLOWED_PREFIXES = ["image/", "application/pdf", "audio/"];

function isAllowedMime(mime: string): boolean {
  return ALLOWED_PREFIXES.some((p) => (p.endsWith("/") ? mime.startsWith(p) : mime === p));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: subjectId } = await params;
  if (!(await ownsSubject(userId, subjectId))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  const caption = (form.get("caption") ?? "").toString();
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  const fileId = randomUUID();
  const blobPath = `users/${userId}/subjects/${subjectId}/${fileId}`;

  let blobUrl: string;
  try {
    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("blob put failed:", err);
    return NextResponse.json(
      {
        error: "blob_error",
        message: err instanceof Error ? err.message : "blob upload failed",
      },
      { status: 500 },
    );
  }

  try {
    const record = await createFile(userId, subjectId, {
      blobUrl,
      blobPath,
      mimeType: file.type,
      caption,
    });
    void logActivity({
      userId,
      subjectId,
      type: "files_uploaded",
      data: { count: 1, mimeType: file.type },
    });
    return NextResponse.json({ file: record });
  } catch (err) {
    console.error("createFile failed:", err);
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "db insert failed",
      },
      { status: 500 },
    );
  }
}
