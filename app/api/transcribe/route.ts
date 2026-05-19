import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type Body = {
  apiKey: string;
  fileId: string;
};

type FileRow = {
  id: string;
  blob_url: string;
  mime_type: string;
};

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return bad(401, "Sign in first.", "unauthorized");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad(400, "Send JSON body with apiKey and fileId.");
  }

  if (typeof body.apiKey !== "string" || body.apiKey.trim().length < 10) {
    return bad(401, "Missing or invalid Gemini API key.", "invalid_key");
  }
  if (typeof body.fileId !== "string" || !body.fileId.trim()) {
    return bad(400, "fileId is required.");
  }

  // Look up the file, scoped to user
  const { rows } = await sql<FileRow>`
    SELECT id, blob_url, mime_type FROM files
    WHERE id = ${body.fileId} AND user_id = ${userId}
  `;
  const file = rows[0];
  if (!file) return bad(404, "File not found.", "not_found");
  if (!file.mime_type.startsWith("audio/")) {
    return bad(400, "Only audio files can be transcribed.", "wrong_type");
  }

  // Download the audio blob
  let audioBase64: string;
  try {
    const blobRes = await fetch(file.blob_url);
    if (!blobRes.ok) throw new Error(`blob fetch ${blobRes.status}`);
    const ab = await blobRes.arrayBuffer();
    audioBase64 = Buffer.from(ab).toString("base64");
  } catch (err) {
    console.error("blob fetch failed:", err);
    return bad(502, "Couldn't fetch the audio file.", "blob_unreachable");
  }

  // Call Gemini for transcription
  const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    MODEL,
  )}:generateContent?key=${encodeURIComponent(body.apiKey)}`;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Transcribe this audio recording. Return only the spoken words as plain text, no preamble, no formatting. If the audio is silent or unclear, return an empty string.",
              },
              {
                inline_data: {
                  mime_type: file.mime_type,
                  data: audioBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "text/plain",
        },
      }),
    });
  } catch {
    return bad(502, "Couldn't reach the AI service.", "gemini_unreachable");
  }

  if (!geminiRes.ok) {
    if (geminiRes.status === 401 || geminiRes.status === 403) {
      return bad(401, "API key was rejected.", "invalid_key");
    }
    if (geminiRes.status === 429) {
      return bad(429, "Rate-limited. Try again in a minute.", "rate_limited");
    }
    return bad(502, `AI service returned ${geminiRes.status}.`, "gemini_failed");
  }

  type GeminiResponse = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const data = (await geminiRes.json()) as GeminiResponse;
  const transcription = (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? ""
  );

  // Save the transcription as the file's caption
  await sql`
    UPDATE files SET caption = ${transcription}
    WHERE id = ${body.fileId} AND user_id = ${userId}
  `;

  return NextResponse.json({ ok: true, transcription });
}
