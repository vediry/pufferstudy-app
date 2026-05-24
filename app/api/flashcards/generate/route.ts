import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSubjectWithFiles } from "@/lib/subjects-db";
import { replaceDeck } from "@/lib/flashcards-db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `You generate flashcards from a study cheat sheet.

Return ONLY a valid JSON array. No prose, no markdown fences, no commentary.
Each element is an object: {"front": string, "back": string}.

Rules:
- 10 to 25 cards covering the most important content.
- "front" is a single question or term (1 short sentence).
- "back" is a single concise answer or definition (1-3 sentences, no bullet lists).
- Skip anything that's not factual (avoid opinions, study tips, etc.).
- Don't repeat the same term across multiple cards.
- Keep each side under 240 characters.`;

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

type GeneratedCard = { front: string; back: string };

function extractCardsFromText(raw: string): GeneratedCard[] {
  // The model occasionally wraps the JSON in code fences despite the prompt;
  // strip a leading ```json ... ``` envelope if present.
  let body = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/.exec(body);
  if (fence) body = fence[1].trim();

  // Some models prefix with a sentence — find first '[' and last ']'.
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Couldn't find a JSON array in the AI response.");
  }
  body = body.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("The AI returned malformed JSON. Try regenerating.");
  }
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of cards.");

  const cards: GeneratedCard[] = [];
  for (const item of parsed) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { front?: unknown }).front === "string" &&
      typeof (item as { back?: unknown }).back === "string"
    ) {
      const front = (item as { front: string }).front.trim();
      const back = (item as { back: string }).back.trim();
      if (front && back) cards.push({ front: front.slice(0, 240), back: back.slice(0, 240) });
    }
  }
  if (cards.length === 0) throw new Error("AI response had no usable cards.");
  return cards.slice(0, 25);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return bad(401, "Sign in first.", "unauthorized");

  let body: { subjectId?: unknown; apiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return bad(400, "Request body must be valid JSON.");
  }

  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  if (!subjectId) return bad(400, "subjectId is required.");
  if (apiKey.length < 10) return bad(401, "Missing or invalid API key.", "invalid_key");

  const subject = await getSubjectWithFiles(userId, subjectId);
  if (!subject) return bad(404, "Subject not found.", "not_found");
  if (!subject.cheatsheet_markdown) {
    return bad(
      400,
      "Generate a cheat sheet first — flashcards are made from the sheet content.",
      "no_cheatsheet",
    );
  }

  // One non-streaming Gemini call. Flashcards are short and we need the full
  // parsed JSON anyway, so streaming gains nothing here.
  const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Subject: ${subject.name}\n\nCheat sheet:\n\n${subject.cheatsheet_markdown}\n\nReturn the JSON array now.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
        },
      }),
    });
  } catch {
    return bad(502, "Couldn't reach the AI service.", "gemini_unreachable");
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

  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return bad(502, "AI service returned an unreadable response.", "gemini_failed");
  }

  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!raw) return bad(502, "AI service returned an empty response.", "gemini_failed");

  let cards: GeneratedCard[];
  try {
    cards = extractCardsFromText(raw);
  } catch (err) {
    return bad(
      502,
      err instanceof Error ? err.message : "Couldn't parse flashcards from AI output.",
      "parse_failed",
    );
  }

  const { deck, insertedCards } = await replaceDeck(
    userId,
    subjectId,
    subject.name,
    cards,
  );

  void logActivity({
    userId,
    subjectId,
    type: "flashcards_generated",
    data: { cardCount: insertedCards },
  });

  return NextResponse.json({ deck, cardCount: insertedCards });
}
