// Pure helpers for the Diagrams tab: build the model prompt and parse the
// model's JSON reply into a typed result. No I/O — unit-tested in diagram.test.ts.

export type DiagramType = "mindmap" | "flowchart" | "timeline" | "graph";

export const DIAGRAM_TYPES: DiagramType[] = [
  "mindmap",
  "flowchart",
  "timeline",
  "graph",
];

export type DiagramKeyEntry = { label: string; text: string };

export type DiagramResult = {
  type: DiagramType;
  title: string;
  mermaid: string;
  key: DiagramKeyEntry[];
};

export type DiagramRequest = {
  subjectName?: string;
  materials?: string;
  topic?: string;
  forceType?: DiagramType;
};

export type ParseOutcome =
  | { ok: true; result: DiagramResult }
  | { ok: false; error: string };

// Builds the user-turn text. The system prompt lives in the route.
// Returns "" when there is nothing to map (caller should not send a request).
export function buildDiagramPrompt(req: DiagramRequest): string {
  const topic = req.topic?.trim();
  const materials = req.materials?.trim();
  const parts: string[] = [];

  if (topic) {
    parts.push(`Make a diagram about this topic:\n${topic}`);
  } else if (req.subjectName) {
    parts.push(`Make an overview diagram for the subject "${req.subjectName}".`);
  } else {
    return "";
  }

  if (req.subjectName && materials) {
    parts.push(
      `Use this study material for "${req.subjectName}" as the source of truth:\n<materials>\n${materials}\n</materials>`,
    );
  }

  if (req.forceType) {
    parts.push(
      `Use a ${req.forceType} diagram. Do not pick a different diagram type.`,
    );
  }

  return parts.join("\n\n");
}

function stripFences(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : s;
}

function isKeyEntry(e: unknown): e is DiagramKeyEntry {
  return (
    !!e &&
    typeof e === "object" &&
    typeof (e as DiagramKeyEntry).label === "string" &&
    typeof (e as DiagramKeyEntry).text === "string"
  );
}

export function parseDiagramResponse(raw: string): ParseOutcome {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Empty response from the model." };
  }

  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, error: "Could not read the model response." };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, error: "Unexpected response shape." };
  }

  const obj = data as Record<string, unknown>;
  const mermaid = typeof obj.mermaid === "string" ? obj.mermaid.trim() : "";
  if (!mermaid) {
    return { ok: false, error: "The model didn't return a diagram." };
  }

  const type = DIAGRAM_TYPES.includes(obj.type as DiagramType)
    ? (obj.type as DiagramType)
    : "mindmap";
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const key = Array.isArray(obj.key)
    ? obj.key.filter(isKeyEntry).map((e) => ({ label: e.label, text: e.text }))
    : [];

  return { ok: true, result: { type, title, mermaid, key } };
}

// Conservative pre-render cleanup for model-emitted Mermaid. Never throws;
// returns the input unchanged when nothing matches. Kept pure for testing.
export function sanitizeMermaid(code: string): string {
  if (typeof code !== "string") return "";
  let s = code.replace(/\r\n/g, "\n").trim();
  const fenced = s.match(/^```(?:mermaid)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) s = fenced[1].trim();
  s = s.replace(/<br\s*\/?>/gi, "<br/>");
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return s;
}
