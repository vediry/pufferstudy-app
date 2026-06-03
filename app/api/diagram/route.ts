import { NextResponse } from "next/server";
import {
  buildDiagramPrompt,
  parseDiagramResponse,
  type DiagramRequest,
} from "@/lib/diagram";

// Standalone endpoint for the Diagrams tab. Kept separate from /api/generate
// so it can evolve independently of the production cheat-sheet pipeline.
// Non-streaming; returns a single JSON diagram object.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const DIAGRAM_SYSTEM = `You turn a topic or some study material into ONE clear, readable diagram for a student. Respond with ONLY a JSON object — no prose, no code fences — of this exact shape:
{
  "type": "mindmap" | "flowchart" | "timeline" | "graph",
  "title": "short heading for the diagram",
  "mermaid": "the Mermaid code (no backticks/fences)",
  "key": [ { "label": "short label", "text": "one-line plain-English explanation" } ]
}

Choosing the type — pick the best fit for the request UNLESS the user pins one:
- timeline — events over time / "what happened".
- flowchart TD — a process, steps, an algorithm, or a decision.
- mindmap — an overview of a topic broken into branches.
- graph LR — relationships/connections between concepts.

Make it readable on its own:
- For flowchart and graph, give each node a QUOTED label with a short title, then a <br/> line break, then a one-line description — e.g. A["☀️ Sunlight<br/>energy that powers the reaction"]. Quoting + <br/> is required so punctuation does not break parsing.
- For mindmap and timeline (which are stricter about multi-line text), keep node labels SHORT and put the detail in the key instead.
- Always fill "key" with 3 to 6 entries that explain the main parts in plain words.

Mermaid rules (follow exactly so it renders):
- Keep it focused: roughly 6 to 12 nodes.
- Give every node a single leading emoji that fits the subject (history 🏛️ 📜 ⚔️, biology 🧬 🔬 🌿, chemistry ⚗️ 🧪, geography 🗺️ 🌋, economics 💰 📈, etc.) then the label.
- ALWAYS use quoted labels for flowchart and graph nodes — e.g. A["..."] — never leave a flowchart/graph label unquoted. Inside any UNQUOTED label (mindmap and timeline only) use ONLY a leading emoji plus letters, numbers and spaces — no parentheses, quotes, colons, semicolons, slashes, or other punctuation.
- mindmap: first line is mindmap, then a root like root((🌱 Topic)), then indented child nodes.
- timeline: first line is timeline, then optional title line, then "period : 🔖 event" rows.

Honesty: never invent facts. If material is provided, base the diagram on it.`;

export async function POST(req: Request) {
  let body: DiagramRequest & { apiKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Add your Gemini API key in Settings first." },
      { status: 400 },
    );
  }

  const prompt = buildDiagramPrompt(body);
  if (!prompt) {
    return NextResponse.json(
      { error: "Pick a subject or type a topic first." },
      { status: 400 },
    );
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
        systemInstruction: { parts: [{ text: DIAGRAM_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the model. Check your connection." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const friendly =
      res.status === 400 || res.status === 403
        ? "The model rejected the request — your Gemini API key may be invalid."
        : "The model is having trouble right now. Try again in a moment.";
    return NextResponse.json({ error: friendly }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text ?? "")
    .join("")
    .trim();

  const outcome = parseDiagramResponse(text ?? "");
  if (!outcome.ok) {
    console.error("[/api/diagram] parse failed:", outcome.error);
    return NextResponse.json(
      { error: "Couldn't build that diagram. Try rephrasing or regenerate." },
      { status: 502 },
    );
  }

  return NextResponse.json(outcome.result);
}
