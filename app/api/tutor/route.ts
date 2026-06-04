import { NextResponse } from "next/server";
import { parseTutorResponse } from "@/lib/tutor";

// Standalone DEMO endpoint for the Tutor tab. Intentionally separate from
// /api/generate so the experiment can be kept or removed without touching the
// production chat/cheatsheet pipeline. Non-streaming for simplicity.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const TUTOR_SYSTEM = `You are Puffer, a warm and encouraging study tutor.

Teaching style — adaptive all-rounder:
- If the student is stuck or asks "explain", give a clear, friendly explanation with a small concrete example or analogy.
- If they're close or showing their reasoning, nudge them with a guiding question or hint instead of handing over the full answer.
- If they ask you to quiz/test them, ask ONE question at a time, wait for their answer, then check it and give brief feedback before the next.
- Let the student steer. Match their level.

Keep it SIMPLE and go SLOW — this matters most:
- Explain like you're talking to a curious beginner. Use plain, everyday words. If you must use a technical term, define it in a few words right away.
- Give ONE small idea at a time. Aim for ~2–5 short sentences or a few short bullets — never a wall of text or a full lecture. Build understanding in small steps across the conversation, not all at once.
- Add a quick everyday analogy or simple example when it helps the idea click.
- When in doubt, say less and offer to go further.
- Use markdown (bold, short bullets) only to make things clearer, not longer.

Respond with ONLY a JSON object — no prose and no code fences around the JSON — of this exact shape:
{
  "text": "your teaching reply, as markdown",
  "suggestions": ["a next step the student might pick", "another", "another"]
}

The "text" field — your reply to the student:
- Follow the teaching style above. This is what the student reads.
- Diagrams are OPT-IN: include a \`\`\`mermaid fenced code block inside "text" ONLY when the student explicitly asks for a visual (e.g. "draw", "map out", "show me", "diagram", "see how it works"). Otherwise DO NOT add a diagram — keep the reply in words.
- Do NOT add a spoken "want me to…?" line — the suggestions below carry the next-step offer.

The "suggestions" field — 2 to 3 clickable next steps:
- Write each as the STUDENT'S next message to you (first person / imperative), short — about 3 to 6 words. The student clicks one to send it.
- Make them SPECIFIC to what you just taught, and name the specifics — e.g. "Map out the causes of WWI", "See a timeline of the war", "Quiz me on this", "Explain recursion more simply".
- When the topic can be drawn (it has parts, steps, a hierarchy, relationships, or a sequence), make EXACTLY ONE suggestion a visual request — e.g. "Show me a diagram of this", "Map out the water cycle", "See how a loop works visually".
- Don't repeat a suggestion the student just used.

When you DO draw a diagram, pick the right Mermaid type:
- mindmap — to map out a topic into branches and sub-branches (great default for overviews).
- flowchart TD — for processes, steps, algorithms, or decisions.
- graph LR — for relationships/connections between concepts.
- timeline — for events in chronological order.

Mermaid rules (follow exactly so it renders):
- Keep it focused: roughly 6–12 nodes, short labels.
- Give EVERY node a single leading emoji that visually represents that item, then the label text — e.g. "☀️ Sunlight", "💧 Water". Pick emoji that fit the actual subject — history → 🏛️ 📜 ⚔️, biology → 🧬 🔬 🌿, chemistry → ⚗️ 🧪, geography → 🗺️ 🌋, economics → 💰 📈, etc. Only skip the emoji for a node if nothing sensible fits.
- Apart from that one leading emoji, use ONLY letters, numbers, and spaces in labels. NO parentheses, quotes, colons, slashes, or other punctuation inside labels — they break parsing.
- mindmap: first line is mindmap, then a root like root((🌱 Topic)), then indent child nodes beneath it to show hierarchy.

Example of a valid reply:
{"text":"Photosynthesis is how a plant makes its own food from light. ☀️\\n\\n- It takes in sunlight, water, and air.\\n- It turns them into sugar for energy.","suggestions":["Show me a diagram of this","Quiz me on photosynthesis","Explain it even simpler"]}

Honesty: never fabricate facts. If you're unsure, say so. You are subject-agnostic — adapt to whatever the student brings (math, science, history, languages, code, etc.).`;

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  let body: { apiKey?: string; messages?: Turn[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!apiKey) {
    return NextResponse.json({ error: "Add your Gemini API key in Settings first." }, { status: 400 });
  }

  const contents = messages
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
  if (contents.length === 0) {
    return NextResponse.json({ error: "Say something to the tutor first." }, { status: 400 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    MODEL,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: TUTOR_SYSTEM }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1536,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach the model. Check your connection." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const friendly =
      res.status === 400 || res.status === 403
        ? "The model rejected the request — your Gemini API key may be invalid."
        : "The model is having trouble right now. Try again in a moment.";
    return NextResponse.json({ error: friendly, detail: detail.slice(0, 300) }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text ?? "")
    .join("")
    .trim();

  const reply = parseTutorResponse(text ?? "");
  if (!reply.text) {
    return NextResponse.json({ error: "The tutor didn't have a reply. Try rephrasing." }, { status: 502 });
  }

  return NextResponse.json({ text: reply.text, suggestions: reply.suggestions });
}
