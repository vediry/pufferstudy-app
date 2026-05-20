import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  systemPromptFor,
  userPromptForCheatsheet,
  userPromptForChat,
  userPromptForPractice,
  userPromptForRefine,
  type GenerateMode,
} from "@/lib/prompts";
import { getFilesByIds } from "@/lib/subjects-db";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type Body = {
  apiKey: string;
  mode: GenerateMode;
  subjectName: string;
  testLabel?: string;
  fileIds: string[];
  question?: string;
  history?: ChatMessage[];
  currentSheet?: string;   // refine mode only
  message?: string;        // refine mode only
};

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

async function blobUrlToBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    const ab = await res.arrayBuffer();
    const data = Buffer.from(ab).toString("base64");
    return { mimeType, data };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return bad(401, "Sign in to generate.", "unauthorized");

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad(400, "Request body must be valid JSON.");
  }

  const { apiKey, mode, subjectName, fileIds } = body;

  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return bad(401, "Missing or invalid API key.", "invalid_key");
  }
  if (mode !== "cheatsheet" && mode !== "chat" && mode !== "practice" && mode !== "refine") {
    return bad(400, "Mode must be cheatsheet, chat, practice, or refine.");
  }
  if (typeof subjectName !== "string" || !subjectName.trim()) {
    return bad(400, "subjectName is required.");
  }
  if (!Array.isArray(fileIds)) {
    return bad(400, "fileIds must be an array.");
  }
  if (mode !== "chat" && mode !== "refine" && fileIds.length === 0) {
    return bad(400, "Add at least one file before generating.");
  }

  let userPrompt: string;
  let validFiles: Array<{ mimeType: string; data: string }> = [];
  const captions: string[] = [];

  if (mode === "refine") {
    if (typeof body.currentSheet !== "string" || !body.currentSheet.trim()) {
      return bad(400, "Refine requires a non-empty currentSheet.");
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
      return bad(400, "Refine requires a message.");
    }
    userPrompt = userPromptForRefine({
      subjectName,
      currentSheet: body.currentSheet,
      message: body.message,
    });
  } else {
    // Fetch the files the user owns from DB, then download blobs in parallel
    const records = await getFilesByIds(userId, fileIds);
    for (const r of records) captions.push(r.caption ?? "");
    const inlinedFiles = await Promise.all(
      records.map((r) => blobUrlToBase64(r.blob_url)),
    );
    validFiles = inlinedFiles.filter((f): f is { mimeType: string; data: string } => f !== null);

    if (mode === "cheatsheet") {
      userPrompt = userPromptForCheatsheet({
        subjectName,
        testLabel: body.testLabel,
        captions,
      });
    } else if (mode === "practice") {
      userPrompt = userPromptForPractice({ subjectName, captions });
    } else {
      if (typeof body.question !== "string" || !body.question.trim()) {
        return bad(400, "Chat requires a question.");
      }
      userPrompt = userPromptForChat({
        subjectName,
        question: body.question,
        history: body.history ?? [],
        captions,
      });
    }
  }

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: userPrompt }];
  for (const f of validFiles) {
    parts.push({ inline_data: { mime_type: f.mimeType, data: f.data } });
  }

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
  }> = [];

  if ((mode === "chat" || mode === "refine") && body.history && body.history.length > 0) {
    for (const m of body.history) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }
  contents.push({ role: "user", parts });

  const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    MODEL,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPromptFor(mode) }] },
        generationConfig: {
          temperature: mode === "practice" ? 0.4 : 0.6,
          maxOutputTokens: 4096,
          responseMimeType: mode === "practice" ? "application/json" : "text/plain",
        },
      }),
    });
  } catch {
    return bad(502, "Couldn't reach the AI service. Check your connection.", "gemini_unreachable");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return bad(401, "API key was rejected. Update it in Settings.", "invalid_key");
    }
    if (res.status === 429) {
      return bad(429, "Hit the AI service rate limit. Try again in a minute.", "rate_limited");
    }
    return bad(502, `AI service returned ${res.status}.`, "gemini_failed");
  }
  if (!res.body) {
    return bad(502, "AI service returned no body.", "gemini_failed");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const upstreamReader = res.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            };
            const text = obj.candidates?.[0]?.content?.parts
              ?.map((p) => p.text ?? "")
              .join("");
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // ignore malformed SSE line
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void upstreamReader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
