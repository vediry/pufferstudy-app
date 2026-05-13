import { NextResponse } from "next/server";
import {
  systemPromptFor,
  userPromptForCheatsheet,
  userPromptForChat,
  userPromptForPractice,
  type GenerateMode,
} from "@/lib/prompts";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The default Gemini model. Flash is fast, multimodal, and free-tier friendly.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type InlineImage = {
  mimeType: string;
  data: string; // base64, no data: prefix
};

type Body = {
  apiKey: string;
  mode: GenerateMode;
  subjectName: string;
  testLabel?: string;
  images: InlineImage[];
  captions: string[];
  // chat-only
  question?: string;
  history?: ChatMessage[];
};

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad(400, "Request body must be valid JSON.");
  }

  const { apiKey, mode, subjectName, images, captions } = body;

  if (typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return bad(401, "Missing or invalid API key.", "invalid_key");
  }
  if (mode !== "cheatsheet" && mode !== "chat" && mode !== "practice") {
    return bad(400, "Mode must be cheatsheet, chat, or practice.");
  }
  if (typeof subjectName !== "string" || !subjectName.trim()) {
    return bad(400, "subjectName is required.");
  }
  if (!Array.isArray(images)) {
    return bad(400, "images must be an array.");
  }
  if (!Array.isArray(captions)) {
    return bad(400, "captions must be an array.");
  }
  if (mode !== "chat" && images.length === 0) {
    return bad(400, "Add at least one photo before generating.");
  }

  let userPrompt: string;
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

  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: userPrompt }];
  for (const img of images) {
    if (!img || typeof img.data !== "string" || typeof img.mimeType !== "string") continue;
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  }

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>;
  }> = [];

  if (mode === "chat" && body.history && body.history.length > 0) {
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

  // Stream SSE chunks, extract text deltas, forward as plain text.
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
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
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
