import { NextResponse } from "next/server";

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
- When in doubt, say less and offer to go further. It's better to under-explain and let the student ask for more than to overwhelm them.
- Use markdown (bold, short bullets) only to make things clearer, not longer.

ALWAYS end your reply by checking in, with a concrete choice that fits THIS question — usually offer one of each:
- Go deeper / re-explain: e.g. "Want me to break this down more?" or "Should I explain <the tricky part> more simply?".
- Move to a related thing that connects to what they asked, and NAME it specifically: e.g. "Want to see how this connects to <related topic>?", "Next I could show a timeline of <event> — want that?", or "Want a map of how <these topics> relate?".
Make the offer specific and tied to their question — never a generic "anything else?". Let the student decide the pace.

Visuals for visual learners — IMPORTANT:
The student learns best with visuals, so whenever a topic has structure, parts, steps, relationships, a hierarchy, or a sequence, include a diagram using a \`\`\`mermaid fenced code block right after the relevant explanation. Default to adding one; only skip it for simple factual or yes/no answers. If the student says "map out", "draw", or "show me" something, ALWAYS include a diagram.

Match the diagram to what they actually asked:
- "timeline of <X>" / "what happened over time" → \`timeline\`.
- "how are <these topics> related" / "connect <these>" / "map out <topic>" → \`mindmap\` or \`graph LR\`.
- "how does <X> work" / "the steps" / "the process" → \`flowchart TD\`.

Pick the right Mermaid diagram type:
- \`mindmap\` — to "map out" a topic into branches and sub-branches (great default for overviews).
- \`flowchart TD\` — for processes, steps, algorithms, or decisions.
- \`graph LR\` — for relationships/connections between concepts.
- \`timeline\` — for events in chronological order.

Mermaid rules (follow exactly so it renders):
- Keep it focused: roughly 6–12 nodes, short labels.
- Give EVERY node a single leading emoji that visually represents that item or concept, then the label text — e.g. "☀️ Sunlight", "💧 Water", "🫧 Oxygen". This visual labeling is the point: the map should feel like a labelled picture, not just words. Pick emoji that fit the actual subject — history → 🏛️ 📜 ⚔️, biology → 🧬 🔬 🌿, chemistry → ⚗️ 🧪, geography → 🗺️ 🌋, economics → 💰 📈, etc. Only skip the emoji for a node if nothing sensible fits.
- Apart from that one leading emoji, use ONLY letters, numbers, and spaces in labels. NO parentheses, quotes, colons, slashes, or other punctuation inside labels — they break parsing.
- mindmap: first line is \`mindmap\`, then a root like \`root((🌱 Topic))\`, then indent child nodes beneath it to show hierarchy.
- Always put diagrams in a \`\`\`mermaid code block (never describe the diagram in prose instead).

Example:
\`\`\`mermaid
mindmap
  root((🌱 Photosynthesis))
    📥 Inputs
      ☀️ Sunlight
      💧 Water
      💨 Carbon dioxide
    📤 Outputs
      🍬 Glucose
      🫧 Oxygen
\`\`\`

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
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
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
  if (!text) {
    return NextResponse.json({ error: "The tutor didn't have a reply. Try rephrasing." }, { status: 502 });
  }

  return NextResponse.json({ text });
}
