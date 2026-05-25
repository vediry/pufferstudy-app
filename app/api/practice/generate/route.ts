import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSubjectWithFiles } from "@/lib/subjects-db";
import { createQuiz, type QuizQuestion } from "@/lib/practice-db";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `You generate practice quizzes for a student preparing for a test.

Output ONLY a JSON array of question objects. No prose, no markdown fences.

Each element must match one of these two shapes:

Multiple choice:
{
  "kind": "multiple_choice",
  "prompt": "single question, 1 sentence",
  "choices": ["A...", "B...", "C...", "D..."],
  "correctIndex": 0,
  "topic": "short topic name (2-4 words)"
}

Short answer:
{
  "kind": "short_answer",
  "prompt": "single question, 1 sentence",
  "expectedAnswer": "the canonical 1-2 sentence answer",
  "topic": "short topic name (2-4 words)"
}

Rules:
- Produce 8 to 12 questions total.
- Mix about 60% multiple_choice and 40% short_answer.
- For multiple_choice, provide exactly 4 distinct choices. Wrong choices should be plausible distractors, not obviously wrong.
- correctIndex is 0-based (0, 1, 2, or 3).
- Cover at least 4 different topics from the cheat sheet. Group conceptually related questions under the same topic string.
- Topics should be short labels like "Light Reactions" or "Calvin Cycle", not full sentences.
- All content must be grounded in the cheat sheet — don't invent facts.
- Each "prompt" is under 200 characters.`;

function bad(status: number, message: string, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status });
}

function extractQuestions(raw: string): QuizQuestion[] {
  let body = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/.exec(body);
  if (fence) body = fence[1].trim();

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
    throw new Error("AI returned malformed JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");

  const out: QuizQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const kind = obj.kind;
    const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : "";
    const topic = typeof obj.topic === "string" ? obj.topic.trim() : "General";
    if (!prompt) continue;

    if (kind === "multiple_choice") {
      const choices = Array.isArray(obj.choices) ? obj.choices : [];
      const correctIndex = typeof obj.correctIndex === "number" ? obj.correctIndex : -1;
      if (choices.length !== 4) continue;
      if (correctIndex < 0 || correctIndex > 3) continue;
      const cleanChoices = choices.map((c) => (typeof c === "string" ? c.trim() : ""));
      if (cleanChoices.some((c) => !c)) continue;
      out.push({
        kind: "multiple_choice",
        prompt: prompt.slice(0, 300),
        choices: cleanChoices,
        correctIndex,
        topic: topic.slice(0, 60),
      });
    } else if (kind === "short_answer") {
      const expected = typeof obj.expectedAnswer === "string" ? obj.expectedAnswer.trim() : "";
      if (!expected) continue;
      out.push({
        kind: "short_answer",
        prompt: prompt.slice(0, 300),
        expectedAnswer: expected.slice(0, 600),
        topic: topic.slice(0, 60),
      });
    }
  }
  if (out.length === 0) throw new Error("AI response had no usable questions.");
  return out.slice(0, 12);
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
      "Generate a cheat sheet first — quiz questions are derived from it.",
      "no_cheatsheet",
    );
  }

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
          temperature: 0.5,
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
      return bad(429, "Hit the AI rate limit. Try again in a minute.", "rate_limited");
    }
    return bad(502, `AI service returned ${res.status}.`, "gemini_failed");
  }

  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return bad(502, "AI service returned an unreadable response.", "gemini_failed");
  }

  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!raw) return bad(502, "AI service returned an empty response.", "gemini_failed");

  let questions: QuizQuestion[];
  try {
    questions = extractQuestions(raw);
  } catch (err) {
    return bad(
      502,
      err instanceof Error ? err.message : "Couldn't parse questions.",
      "parse_failed",
    );
  }

  const quiz = await createQuiz(userId, subjectId, subject.name, questions);

  void logActivity({
    userId,
    subjectId,
    type: "practice_generated",
    data: { questionCount: questions.length },
  });

  return NextResponse.json({ quiz });
}
